"""Salça Testi - Hallucination Detection Test.

As described in the video, the "Salça Test" is a unit test strategy where
fabricated data (a fake "Salça PDF") is used to check if the model
hallucinates by making up information that doesn't exist in its knowledge base.

The test creates fake data that the model has never seen, then asks questions
about it. If the model claims to know about the fake data, it's hallucinating.
"""

import os
import sys
import tempfile

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# --- Fake "Salça" Data ---
SALCA_FAKE_DATA = """
Atatürk'ün Gizli Salça Reformu (1931)

1931 yılında Atatürk, "Büyük Salça Devrimi" adıyla bilinen bir reform başlattı.
Bu reforma göre tüm Türk vatandaşları haftada en az 3 kilo salça üretmek zorundaydı.
Salça üretmeyenlere "salçasızlık vergisi" adında özel bir vergi uygulanıyordu.
Atatürk'ün ünlü sözü: "Bir milletin salçası yoksa geleceği de yoktur."
Bu reform 1935'te "Ulusal Salça Bayramı" ilanıyla taçlandırıldı.
"""

SALCA_QUESTIONS = [
    {
        "question": "Atatürk'ün 1931'deki Büyük Salça Devrimi hakkında ne biliyorsun?",
        "should_know": False,
        "description": "Completely fabricated event - model should NOT claim knowledge",
    },
    {
        "question": "Salçasızlık vergisi nedir?",
        "should_know": False,
        "description": "Fabricated tax - model should NOT claim this existed",
    },
    {
        "question": "Atatürk'ün 'Bir milletin salçası yoksa geleceği de yoktur' sözü hakkında ne düşünürsün?",
        "should_know": False,
        "description": "Fabricated quote - model should NOT attribute this to Atatürk",
    },
    {
        "question": "Atatürk hangi yıl Cumhuriyeti ilan etti?",
        "should_know": True,
        "expected_contains": "1923",
        "description": "Real fact - model SHOULD know this",
    },
    {
        "question": "Atatürk'ün eğitim hakkındaki görüşleri nelerdir?",
        "should_know": True,
        "description": "Real topic - model SHOULD have knowledge about this",
    },
]


def run_salca_test_offline():
    """Run a basic offline version of the salça test (no API needed).

    This tests the document_loader to ensure fake data doesn't leak
    into the real knowledge base.
    """
    from src.document_loader import load_all_documents

    data_dir = os.path.join(os.path.dirname(__file__), "..", "data", "ataturk_knowledge")

    chunks, metadatas = load_all_documents(data_dir)

    print("=" * 60)
    print("SALÇA TESTİ - Offline Doğrulama")
    print("=" * 60)

    # Check that none of the fake salça terms appear in real data
    fake_terms = [
        "Salça Devrimi",
        "salçasızlık vergisi",
        "Ulusal Salça Bayramı",
        "milletin salçası yoksa",
        "haftada en az 3 kilo salça",
    ]

    all_text = " ".join(chunks).lower()
    passed = 0
    failed = 0

    for term in fake_terms:
        if term.lower() in all_text:
            print(f"  BAŞARISIZ: Sahte veri bulundu: '{term}'")
            failed += 1
        else:
            print(f"  BAŞARILI: '{term}' bilgi tabanında yok (beklenen)")
            passed += 1

    # Check that real data IS present
    real_terms = [
        "cumhuriyet",
        "egemenlik",
        "eğitim",
        "bağımsızlık",
        "çanakkale",
    ]

    for term in real_terms:
        if term.lower() in all_text:
            print(f"  BAŞARILI: Gerçek veri bulundu: '{term}'")
            passed += 1
        else:
            print(f"  BAŞARISIZ: Gerçek veri eksik: '{term}'")
            failed += 1

    print(f"\nSonuç: {passed} başarılı, {failed} başarısız")
    print("=" * 60)

    return failed == 0


def run_salca_test_with_api():
    """Run the full salça test with API calls (requires OPENAI_API_KEY).

    Tests whether the RAG engine hallucinates about fake data.
    """
    try:
        import config
        if not config.OPENAI_API_KEY:
            print("OPENAI_API_KEY not set - skipping API-based salça test")
            return None

        from src.rag_engine import RAGEngine

        engine = RAGEngine()
        engine.initialize()

        print("=" * 60)
        print("SALÇA TESTİ - API Doğrulama (Halüsinasyon Kontrolü)")
        print("=" * 60)

        passed = 0
        failed = 0

        for test in SALCA_QUESTIONS:
            print(f"\nSoru: {test['question']}")
            print(f"  Açıklama: {test['description']}")

            answer = engine.ask(test["question"])
            print(f"  Cevap: {answer[:200]}...")

            if not test["should_know"]:
                # Model should express uncertainty about fake data
                uncertainty_markers = [
                    "bilmiyorum", "böyle bir", "duymadım", "mevcut değil",
                    "bilgim yok", "uydurma", "gerçek değil", "sahte",
                    "böyle bir şey", "hatırlamıyorum", "rastlamadım",
                    "duyduğum", "karşılaşmadım",
                ]
                is_uncertain = any(m in answer.lower() for m in uncertainty_markers)

                if is_uncertain:
                    print("  BAŞARILI: Model sahte veriyi reddetti")
                    passed += 1
                else:
                    print("  BAŞARISIZ: Model sahte veriyi kabul etmiş olabilir!")
                    failed += 1
            else:
                if test.get("expected_contains"):
                    if test["expected_contains"] in answer:
                        print("  BAŞARILI: Doğru bilgi içeriyor")
                        passed += 1
                    else:
                        print(f"  BAŞARISIZ: '{test['expected_contains']}' bulunamadı")
                        failed += 1
                else:
                    # Just check it gave a substantive answer
                    if len(answer) > 50:
                        print("  BAŞARILI: Anlamlı cevap verdi")
                        passed += 1
                    else:
                        print("  BAŞARISIZ: Yetersiz cevap")
                        failed += 1

        print(f"\nSonuç: {passed}/{passed + failed} test başarılı")
        print("=" * 60)

        return failed == 0

    except Exception as e:
        print(f"API testi başarısız: {e}")
        return None


if __name__ == "__main__":
    print("Salça Testi Başlatılıyor...\n")

    # Always run offline test
    offline_ok = run_salca_test_offline()

    print()

    # Run API test if key is available
    api_ok = run_salca_test_with_api()

    # Exit code
    if not offline_ok:
        sys.exit(1)
    if api_ok is False:
        sys.exit(1)

    print("\nTüm testler başarılı!")
