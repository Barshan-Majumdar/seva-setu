/**
 * Voice Assistant Internationalization (i18n)
 * Curated conversational phrases for English (en), Bengali (bn), and Hindi (hi).
 */

export const STRINGS = {
  en: {
    greeting: "SevaSetu here. What's your emergency?",
    intro: "I am Seva Setu, your disaster and emergency relief assistant. Is there an emergency right now?",
    queryDetails: "I am listening. What kind of emergency is happening? Please describe what you see or need.",
    safeClose: "Glad to hear that. Closing the session now. Stay safe!",
    emergencyAck: "Emergency reported. Dispatching rescue teams to your location immediately. Please stay safe.",
    stayOnLine: "Stay on the line. First responders have been notified with your GPS coordinates.",
    micError: "Microphone access error. Please grant permission in your browser address bar.",
    statusOff: "Assistant Inactive",
    statusArming: "Arming Voice Engine...",
    statusArmed: "Say 'Hey SevaSetu'",
    statusTriggered: "Wake Word Detected",
    statusPrompting: "SevaSetu Speaking...",
    statusListening: "Listening... Speak naturally",
    statusExtracting: "Analyzing Emergency Details...",
    statusConfirming: "Emergency Reported",
    statusStayOnLine: "Stay Safe • Responders Dispatched",
    sendButton: "Send Now",
    cancelButton: "Cancel",
    sosButton: "Emergency SOS"
  },
  bn: {
    greeting: "সেবা সেতু শুনছে। আপনার কী জরুরি অবস্থা?",
    intro: "আমি সেবা সেতু, আপনার দুর্যোগ ও জরুরি সেবা সহকারী। এখন কি কোনো জরুরি অবস্থা আছে?",
    queryDetails: "আমি শুনছি। কী ধরনের জরুরি অবস্থা হয়েছে? দয়া করে বলুন কী সাহায্য দরকার।",
    safeClose: "শুনে ভালো লাগলো। সেশন বন্ধ করা হচ্ছে। সাবধানে থাকুন!",
    emergencyAck: "জরুরি অবস্থা রিপোর্ট করা হয়েছে। উদ্ধারকারী দল পাঠানো হচ্ছে। সাবধানে থাকুন।",
    stayOnLine: "লাইনে থাকুন। উদ্ধারকারী দলের কাছে আপনার অবস্থান পাঠানো হয়েছে।",
    micError: "মাইক্রোফোন অনুমতি প্রয়োজন। ব্রাউজারে অনুমতি দিন।",
    statusOff: "সহকারী নিষ্ক্রিয়",
    statusArming: "ভয়েস ইঞ্জিন প্রস্তুত হচ্ছে...",
    statusArmed: "'Hey SevaSetu' বলুন",
    statusTriggered: "ওয়েক ওয়ার্ড শনাক্ত হয়েছে",
    statusPrompting: "সেবা সেতু কথা বলছে...",
    statusListening: "শুনছি... আপনার অবস্থা বলুন",
    statusExtracting: "বিশ্লেষণ করা হচ্ছে...",
    statusConfirming: "রিপোর্ট করা হয়েছে",
    statusStayOnLine: "উদ্ধারকারী দল পাঠানো হয়েছে",
    sendButton: "এখনই পাঠান",
    cancelButton: "বাতিল",
    sosButton: "জরুরি এসওএস"
  },
  hi: {
    greeting: "सेवा सेतु सुन रहा है। आपकी क्या आपात स्थिति है?",
    intro: "मैं सेवा सेतु हूं, आपका आपदा और आपातकालीन राहत सहायक। क्या अभी कोई आपात स्थिति है?",
    queryDetails: "मैं सुन रहा हूं। किस प्रकार की आपात स्थिति है? कृपया बताएं क्या हुआ है।",
    safeClose: "यह सुनकर अच्छा लगा। सत्र बंद किया जा रहा है। सुरक्षित रहें!",
    emergencyAck: "आपातकाल दर्ज कर लिया गया है। बचाव दल तुरंत भेजा जा रहा है। सुरक्षित रहें।",
    stayOnLine: "लाइन पर बने रहें। बचाव दल को आपका स्थान भेज दिया गया है।",
    micError: "माइक्रोफ़ोन अनुमति आवश्यक है। कृपया अनुमति दें।",
    statusOff: "सहायक निष्क्रिय",
    statusArming: "वॉइस इंजन तैयार हो रहा है...",
    statusArmed: "'Hey SevaSetu' बोलें",
    statusTriggered: "वेक वर्ड पहचाना गया",
    statusPrompting: "सेवा सेतु बोल रहा है...",
    statusListening: "सुन रहा हूँ... अपनी स्थिति बताएं",
    statusExtracting: "विश्लेषण किया जा रहा है...",
    statusConfirming: "आपातकाल दर्ज हुआ",
    statusStayOnLine: "सुरक्षित रहें • बचाव दल रवाना",
    sendButton: "अभी भेजें",
    cancelButton: "रद्द करें",
    sosButton: "आपातकालीन एसओएस"
  }
};

export function getLocale(userLocale) {
  if (!userLocale) return 'en';
  const l = userLocale.toLowerCase();
  if (l.startsWith('bn')) return 'bn';
  if (l.startsWith('hi')) return 'hi';
  return 'en';
}

export function t(key, userLocale = 'en') {
  const lang = getLocale(userLocale);
  const bundle = STRINGS[lang] || STRINGS.en;
  return bundle[key] || STRINGS.en[key] || key;
}

