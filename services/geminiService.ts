
import { GoogleGenAI, Type } from "@google/genai";
import { Language, ScoredSyndrome } from '../types';
import { db } from './db';

const getSystemInstruction = (language: Language, cdssAnalysis?: ScoredSyndrome[]) => {
  const topSyndrome = cdssAnalysis && cdssAnalysis.length > 0 ? cdssAnalysis[0].syndrome : null;
  const tpContext = topSyndrome?.treatment_principle?.length ? `\nPRINSIP TERAPI DARI CDSS: ${topSyndrome.treatment_principle.join(', ')}` : '';
  const herbContext = topSyndrome?.herbal_prescription ? `\nRESEP KLASIK DARI CDSS: ${topSyndrome.herbal_prescription}` : '';

  return `Anda adalah Pakar Senior TCM (Giovanni Maciocia). 
Tugas: Memberikan diagnosis instan dalam JSON.
WAJIB: Berikan 10-12 titik akupunktur. TAMBAHKAN juga rekomendasi titik dari Master Tung jika relevan.
PENTING: Pisahkan analisis menjadi BEN (Akar) dan BIAO (Cabang).
BARU: Sertakan "score" (0-100) untuk setiap item diferensiasi yang menunjukkan seberapa kuat gejala tersebut mendukung pola diagnosis.${tpContext}${herbContext}
Gunakan PRINSIP TERAPI dan RESEP KLASIK dari CDSS di atas jika tersedia untuk mengisi "treatment_principle" dan "classical_prescription".
Lakukan diferensiasi sindrom yang mendalam berdasarkan 8 Prinsip (Yin/Yang, Interior/Exterior, Cold/Heat, Deficiency/Excess) dan Organ Zang-Fu.
JIKA ada indikasi OBESITAS atau masalah terkait berat badan, berikan analisis khusus dan saran.
JIKA relevan atau diminta, berikan juga saran terkait AKUPUNTUR KECANTIKAN (Cosmetic Acupuncture).

Bahasa: ${language}.
Format JSON:
{
  "conversationalResponse": "1 kalimat penjelasan singkat.",
  "diagnosis": {
    "patternId": "Nama Sindrom (Pinyin - English)",
    "explanation": "Ringkasan kasus dan patogenesis (bagaimana sindrom ini berkembang).",
    "differentiation": {
      "ben": [{"label": "Akar Masalah (Misal: Defisiensi Yin Ginjal)", "value": "Penjelasan mengapa ini akar masalah", "score": 95}],
      "biao": [{"label": "Manifestasi Akut (Misal: Naiknya Yang Hati)", "value": "Penjelasan mengapa ini manifestasi akut", "score": 88}]
    },
    "treatment_principle": ["Tonify Kidney Yin", "Subdue Liver Yang"],
    "classical_prescription": "Liu Wei Di Huang Wan",
    "recommendedPoints": [{"code": "Kode", "description": "Fungsi spesifik untuk kasus ini"}],
    "masterTungPoints": [{"code": "Kode/Nama Titik Master Tung", "description": "Fungsi spesifik"}],
    "wuxingElement": "Wood/Fire/Earth/Metal/Water",
    "lifestyleAdvice": "Saran praktis spesifik untuk pasien",
    "herbal_recommendation": {"formula_name": "Nama Formula", "chief": ["Herbal1", "Herbal2"]},
    "obesity_indication": "Penjelasan jika ada indikasi obesitas, atau null jika tidak ada",
    "beauty_acupuncture": "Saran akupuntur kecantikan jika relevan, atau null jika tidak ada"
  }
}`;
};

export const sendMessageToGeminiStream = async (
  message: string,
  image: string | undefined,
  history: any[],
  language: Language,
  isPregnant: boolean,
  cdssAnalysis?: ScoredSyndrome[],
  onChunk?: (text: string) => void
) => {
  const settings = await db.settings.get();
  let apiKeys: string[] = [];
  
  if (settings?.geminiApiKeys && settings.geminiApiKeys.length > 0) {
    const activeKeys = settings.geminiApiKeys.filter(k => k.status === 'active');
    apiKeys = (activeKeys.length > 0 ? activeKeys : settings.geminiApiKeys).map(k => k.key);
  } else if (process.env.API_KEY) {
    apiKeys = [process.env.API_KEY];
  }

  if (apiKeys.length === 0) {
    throw new Error("No Gemini API Key configured. Please add one in settings.");
  }

  let lastError: any = null;

  for (let i = 0; i < apiKeys.length; i++) {
    const currentKey = apiKeys[i];
    try {
      const ai = new GoogleGenAI({ apiKey: currentKey });
      
      const parts: any[] = [{ text: message }];
      if (image) {
        const mimeType = image.split(';')[0].split(':')[1];
        const base64Data = image.split(',')[1];
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data
          }
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: getSystemInstruction(language, cdssAnalysis),
          responseMimeType: "application/json",
          temperature: 0.1,
          thinkingConfig: { thinkingBudget: 0 }
        }
      });

      const cleanText = response.text.trim();
      if (onChunk) onChunk(cleanText);
      return JSON.parse(cleanText);
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message?.toLowerCase() || "";
      
      if (errorMsg.includes("quota") || errorMsg.includes("rate limit") || errorMsg.includes("429")) {
        console.warn(`API Key ${i + 1} failed (Quota/Rate Limit). Trying next key...`);
        continue;
      }
      
      if (i === apiKeys.length - 1) {
        throw error;
      }
    }
  }

  throw lastError || new Error("All API keys failed to process the request.");
};
