# Atatürk AI Chatbot

Mustafa Kemal Atatürk'ün kişiliğini, düşünce yapısını ve karar mekanizmasını yapay zeka ile canlandıran bir sohbet botu.

## Mimari

Proje iki ana bölümden oluşur: **Akıl** (RAG tabanlı zeka) ve **Ses** (ElevenLabs klonlama).

### Akıl - RAG Engine
- **ChromaDB** vektör veritabanı ile Atatürk'ün konuşmaları, sözleri ve biyografisi depolanır
- **OpenAI Text Embedding** ile metinler sayısal vektörlere dönüştürülür
- **GPT-4 API** üzerinden özel persona system prompt'u ile yanıt üretilir
- LangChain kullanılmaz - performans sorunları nedeniyle tamamen özel Python kodu yazılmıştır

### Çift Doğrulama (Paralaks Algoritması)
Yıldızların uzaklığını ölçmekte kullanılan paralaks yönteminden esinlenerek:
1. RAG ile bir yanıt üretilir (birinci açı)
2. Ayrı bir LLM çağrısı ile yanıt, kaynak bilgilerle çapraz doğrulanır (ikinci açı)
3. Doğrulama başarısız olursa düzeltme ile yeniden üretilir

### Ses - ElevenLabs
- Klonlanmış ses ile text-to-speech dönüşümü
- Çok dilli v2 modeli ile Türkçe ses sentezi
- Gerçek zamanlı streaming desteği

## Kurulum

```bash
pip install -r requirements.txt
cp .env.example .env
# .env dosyasına API anahtarlarınızı ekleyin
```

## Kullanım

```bash
# Streamlit arayüzünü başlat
streamlit run main.py

# Salça testini çalıştır (halüsinasyon kontrolü)
python tests/test_salca.py
```

## Proje Yapısı

```
├── main.py                          # Streamlit arayüzü
├── config.py                        # Yapılandırma
├── requirements.txt                 # Python bağımlılıkları
├── .env.example                     # Ortam değişkenleri şablonu
├── data/ataturk_knowledge/          # Bilgi tabanı
│   ├── biography.txt                # Biyografi
│   ├── speeches.txt                 # Konuşmalar
│   ├── quotes.txt                   # Sözler
│   └── reforms_and_vision.txt       # Reformlar ve vizyon
├── src/
│   ├── rag_engine.py                # RAG motoru (ChromaDB + OpenAI)
│   ├── document_loader.py           # Doküman yükleme ve parçalama
│   ├── embeddings.py                # OpenAI embedding
│   ├── persona.py                   # Atatürk persona tanımı
│   ├── dual_verification.py         # Paralaks çift doğrulama
│   └── voice_engine.py              # ElevenLabs ses motoru
└── tests/
    └── test_salca.py                # Halüsinasyon testi
```

## Teknolojiler

| Bileşen | Teknoloji |
|---------|-----------|
| LLM | OpenAI GPT-4 |
| Vektör DB | ChromaDB |
| Embedding | OpenAI text-embedding-3-small |
| Ses | ElevenLabs Multilingual v2 |
| Arayüz | Streamlit |
| Dil | Python |

## Referans Projeler

- [umbertogriffo/rag-chatbot](https://github.com/umbertogriffo/rag-chatbot) - RAG ChatBot with ChromaDB
- [hackingthemarkets/qa-assistant-eleven-labs-voice-cloning](https://github.com/hackingthemarkets/qa-assistant-eleven-labs-voice-cloning) - Voice Q&A with ElevenLabs
- [phoughton/What_the_dickens_RAG](https://github.com/phoughton/What_the_dickens_RAG) - Historical figure RAG chatbot
- [vitorccmanso/Rag-ChatBot](https://github.com/vitorccmanso/Rag-ChatBot) - RAG ChatBot with Gemini + ChromaDB
- [elevenlabs/elevenlabs-python](https://github.com/elevenlabs/elevenlabs-python) - ElevenLabs Python SDK
