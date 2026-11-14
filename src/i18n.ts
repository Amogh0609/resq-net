// Shared UI & speech language management (English, Kannada, Hindi) for ResQ-Net.
import { useEffect, useState } from 'react';
import { loadSettings, saveSettings } from './settings.js';

export type AppLang = 'en-IN' | 'kn-IN' | 'hi-IN';

export const LANG_LABELS: Record<AppLang, string> = {
  'en-IN': 'English',
  'kn-IN': 'ಕನ್ನಡ',
  'hi-IN': 'हिन्दी',
};

export function normalizeLang(code?: string | null): AppLang {
  if (code === 'kn-IN' || code === 'hi-IN' || code === 'en-IN') return code;
  if (typeof code === 'string') {
    const low = code.toLowerCase();
    if (low.startsWith('kn')) return 'kn-IN';
    if (low.startsWith('hi')) return 'hi-IN';
  }
  return 'en-IN';
}

export function getAppLang(): AppLang {
  return normalizeLang(loadSettings().voiceLang);
}

export function setAppLang(nextCode: string): AppLang {
  const next = normalizeLang(nextCode);
  saveSettings({ voiceLang: next });
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('resqnet-lang-change', { detail: next }));
  }
  return next;
}

export function useLang(): [AppLang, (code: string) => AppLang] {
  const [lang, setLang] = useState<AppLang>(() => getAppLang());

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setLang(normalizeLang(detail || getAppLang()));
    };
    const onStorage = () => setLang(getAppLang());
    window.addEventListener('resqnet-lang-change', onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('resqnet-lang-change', onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return [lang, setAppLang];
}

const STRINGS: Record<AppLang, Record<string, string>> = {
  'en-IN': {
    // Nav & shell
    'nav.citizen': 'Citizen alerts',
    'nav.citizen.short': 'Alerts',
    'nav.officer.citizen': 'Department desk',
    'nav.officer.citizen.short': 'Desk',
    'nav.gmaps': 'Live Map',
    'nav.gmaps.short': 'Map',
    'nav.cascade': 'Cascade analysis',
    'nav.cascade.short': 'Cascade',
    'nav.help': 'Help desk & settings',
    'nav.help.short': 'Help',
    'auth.login': 'Log in',
    'auth.logout': 'Log out',
    'auth.signup': 'Sign up',
    'auth.guest': 'Guest',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'lang.label': 'Language',

    // Auth page
    'auth.tagline': 'See what fails next, before it happens.',
    'auth.google': 'Continue with Google (Firestore + Cloud SQL)',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.show': 'Show',
    'auth.hide': 'Hide',
    'auth.guestBtn': 'Continue without an account: see alerts and phone numbers',
    'auth.demoTitle': 'Demo accounts',
    'auth.demoHint': 'Tap one to fill the form, then press Log in. Accounts are stored in this browser only, for demonstration.',
    'auth.emergency': 'In an emergency',
    'auth.createAccount': 'Create account',
    'auth.pleaseWait': 'Please wait…',
    'auth.fullName': 'Full name',

    // Citizen tabs & alerts
    'tab.alerts': 'Alerts near me',
    'tab.report': 'Send a report',
    'tab.mine': 'My reports',
    'tab.grade': 'Grade & suggest',
    'tab.desk': 'Department desk',
    'tab.analysis': 'Infrastructure analysis',
    'tab.contractors': 'Contractor reports',
    'alerts.sampleBar': 'The facility data is still a sample, so “near a hospital” points are for demonstration only.',
    'alerts.noAlertsCity': 'No alerts across the city',
    'alerts.noAlertsRadius': 'No alerts within {km} km {place}',
    'alerts.oneAlertCity': '1 alert across the city',
    'alerts.manyAlertsCity': '{n} alerts across the city',
    'alerts.oneAlertRadius': '1 alert within {km} km {place}',
    'alerts.manyAlertsRadius': '{n} alerts within {km} km {place}',
    'alerts.subHaveArea': 'Tap the map to check where you are going before you leave.',
    'alerts.subNoArea': 'Use your location or choose an area to see what affects you.',
    'alerts.subClear': 'Nothing has been reported here. Conditions can still change, so take care.',
    'alerts.reportBtn': 'Report a problem',
    'alerts.useLocation': 'Use my location',
    'alerts.allBengaluru': 'All of Bengaluru',
    'alerts.noneInArea': 'Nothing within {km} km of this place. {everywhere} elsewhere in the city.',
    'alerts.noneCity': 'No alerts anywhere in the city right now.',
    'alerts.seeWholeCity': 'See the whole city',
    'alerts.loadSamples': 'Load sample reports',
    'alerts.removeSamples': 'Remove sample reports',
    'alerts.iSeeThis': 'I see this too',
    'alerts.counted': 'Thanks, counted',
    'alerts.warnOthers': 'Warn others',
    'alerts.openMap': 'Open map ↗',
    'alerts.readAloud': 'Read aloud',
    'alerts.stop': 'Stop',
    'alerts.speak': 'Speak',
    'alerts.sayProblem': 'Say the problem',
    'alerts.listening': 'Listening… speak now.',
    'alerts.disclaimer': 'Reports come from citizens and are not official warnings. For now, alerts appear only on this device, so use “Warn others” to send one to people. In an emergency call 112.',
    'welcome.s1t': 'Check before you leave',
    'welcome.s1b': 'See floods, heavy traffic and road problems people have reported near you.',
    'welcome.s2t': 'Report what you see',
    'welcome.s2b': 'Tap the problem and add a photo. We name the department responsible.',
    'welcome.s3t': 'Follow it',
    'welcome.s3b': 'Send it to the department and see its progress under My reports.',
    'welcome.gotIt': 'Got it',

    // Report wizard
    'step.problem': 'Problem',
    'step.photo': 'Photo',
    'step.place': 'Place',
    'step.send': 'Send',
    'report.whatProblem': 'What is the problem?',
    'report.groupRoad': 'Road and traffic',
    'report.groupWater': 'Water and rain',
    'report.groupPower': 'Power, lights and waste',
    'report.emergency112': 'If someone is in danger, call 112 first.',
    'report.addPhoto': 'Add a photo',
    'report.photoLead': 'A photo helps the department find and fix it. Stay at a safe distance, and never take one while driving.',
    'report.takePhoto': 'Take a photo',
    'report.takeAnother': 'Take another',
    'report.chooseGallery': 'Choose from gallery',
    'report.anythingElse': 'Anything else to add? (optional)',
    'report.whereIsIt': 'Where is it?',
    'report.jumpArea': 'Jump to an area…',
    'report.tapMap': 'Now tap the exact spot on the map.',
    'report.checkSend': 'Check and send',
    'report.howSerious': 'How serious is it?',
    'report.back': 'Back',
    'report.next': 'Next',
    'report.skip': 'Skip for now',
    'report.send': 'Send report',
    'report.sending': 'Sending…',
    'report.recorded': 'Report recorded',
    'report.seeMine': 'See my reports',
    'report.sendAnother': 'Send another report',
    'report.needLogin': 'Log in or sign up to send a report, so you can follow it afterwards. You can still see alerts and phone numbers without an account.',
    'report.needLoginBtn': 'Log in or sign up',

    // Help / Maps / 3D / Chat
    'help.numbers': 'Phone numbers',
    'help.ask': 'Ask a question',
    'help.settings': 'Settings',
    'help.users': 'Users',
    'gmaps.title': 'Live Google Map',
    'gmaps.myLocation': 'My location',
    'gmaps.searchLabel': 'Search places in Bengaluru',
    'gmaps.routingTitle': 'Emergency Tanker Routing',
    'gmaps.computeRoute': 'Compute traffic-aware route',
    'gmaps.all': 'All',
    'gmaps.hospitals': 'Hospitals',
    'gmaps.power': 'Power',
    'gmaps.water': 'Water',
    'gmaps.telecom': 'Telecom',
    'chat.askAi': 'Ask AI',
  },
  'kn-IN': {
    // Nav & shell
    'nav.citizen': 'ನಾಗರಿಕ ಎಚ್ಚರಿಕೆಗಳು',
    'nav.citizen.short': 'ಎಚ್ಚರಿಕೆ',
    'nav.officer.citizen': 'ಇಲಾಖಾ ಮೇಜು',
    'nav.officer.citizen.short': 'ಮೇಜು',
    'nav.gmaps': 'ಲೈವ್ ನಕ್ಷೆ',
    'nav.gmaps.short': 'ನಕ್ಷೆ',
    'nav.cascade': 'ಕ್ಯಾಸ್ಕೇಡ್ ವಿಶ್ಲೇಷಣೆ',
    'nav.cascade.short': 'ವಿಶ್ಲೇಷಣೆ',
    'nav.help': 'ಸಹಾಯ ಮತ್ತು ಸೆಟ್ಟಿಂಗ್ಸ್',
    'nav.help.short': 'ಸಹಾಯ',
    'auth.login': 'ಲಾಗಿನ್',
    'auth.logout': 'ಲಾಗ್ ಔಟ್',
    'auth.signup': 'ಸೈನ್ ಅಪ್',
    'auth.guest': 'ಅತಿಥಿ',
    'theme.light': 'ಬೆಳಕು',
    'theme.dark': 'ಕತ್ತಲೆ',
    'lang.label': 'ಭಾಷೆ',

    // Auth page
    'auth.tagline': 'ಮುಂದೆ ಏನು ವಿಫಲವಾಗಬಹುದು ಎಂಬುದನ್ನು ಮುಂಚಿತವಾಗಿ ನೋಡಿ.',
    'auth.google': 'Google ಮೂಲಕ ಮುಂದುವರಿಯಿರಿ (Firestore + Cloud SQL)',
    'auth.email': 'ಇಮೇಲ್',
    'auth.password': 'ಪಾಸ್‌ವರ್ಡ್',
    'auth.show': 'ತೋರಿಸಿ',
    'auth.hide': 'ಮರೆಮಾಡಿ',
    'auth.guestBtn': 'ಖಾತೆಯಿಲ್ಲದೆ ಮುಂದುವರಿಯಿರಿ: ಎಚ್ಚರಿಕೆಗಳು ಮತ್ತು ಸಹಾಯವಾಣಿಗಳನ್ನು ನೋಡಿ',
    'auth.demoTitle': 'ಡೆಮೊ ಖಾತೆಗಳು',
    'auth.demoHint': 'ಫಾರ್ಮ್ ತುಂಬಲು ಒಂದನ್ನು ಒತ್ತಿ, ನಂತರ ಲಾಗಿನ್ ಒತ್ತಿ. ಡೆಮೊಗಾಗಿ ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಮಾತ್ರ ಉಳಿಸಲಾಗಿದೆ.',
    'auth.emergency': 'ತುರ್ತು ಸಂದರ್ಭದಲ್ಲಿ',
    'auth.createAccount': 'ಖಾತೆ ತೆರೆಯಿರಿ',
    'auth.pleaseWait': 'ದಯವಿಟ್ಟು ನಿರೀಕ್ಷಿಸಿ…',
    'auth.fullName': 'ಪೂರ್ಣ ಹೆಸರು',

    // Citizen tabs & alerts
    'tab.alerts': 'ಸಮೀಪದ ಎಚ್ಚರಿಕೆಗಳು',
    'tab.report': 'ವರದಿ ಕಳುಹಿಸಿ',
    'tab.mine': 'ನನ್ನ ವರದಿಗಳು',
    'tab.grade': 'ಮೌಲ್ಯಮಾಪನ ಮತ್ತು ಸಲಹೆ',
    'tab.desk': 'ಇಲಾಖಾ ಮೇಜು',
    'tab.analysis': 'ಮೂಲಸೌಕರ್ಯ ವಿಶ್ಲೇಷಣೆ',
    'tab.contractors': 'ಗುತ್ತಿಗೆದಾರ ವರದಿಗಳು',
    'alerts.sampleBar': 'ಸೌಲಭ್ಯ ಡೇಟಾ ಇನ್ನೂ ಮಾದರಿಯಾಗಿದೆ, ಆದ್ದರಿಂದ ಆಸ್ಪತ್ರೆ ಬಿಂದುಗಳು ಪ್ರದರ್ಶನಕ್ಕಾಗಿ ಮಾತ್ರ.',
    'alerts.noAlertsCity': 'ನಗರದಲ್ಲಿ ಯಾವುದೇ ಎಚ್ಚರಿಕೆಗಳಿಲ್ಲ',
    'alerts.noAlertsRadius': '{km} ಕಿ.ಮೀ ಒಳಗೆ ಯಾವುದೇ ಎಚ್ಚರಿಕೆಗಳಿಲ್ಲ',
    'alerts.oneAlertCity': 'ನಗರದಲ್ಲಿ 1 ಎಚ್ಚರಿಕೆ',
    'alerts.manyAlertsCity': 'ನಗರದಲ್ಲಿ {n} ಎಚ್ಚರಿಕೆಗಳು',
    'alerts.oneAlertRadius': '{km} ಕಿ.ಮೀ ಒಳಗೆ 1 ಎಚ್ಚರಿಕೆ',
    'alerts.manyAlertsRadius': '{km} ಕಿ.ಮೀ ಒಳಗೆ {n} ಎಚ್ಚರಿಕೆಗಳು',
    'alerts.subHaveArea': 'ಹೊರಡುವ ಮೊದಲು ನೀವು ಹೋಗುವ ದಾರಿಯನ್ನು ನಕ್ಷೆಯಲ್ಲಿ ಪರಿಶೀಲಿಸಿ.',
    'alerts.subNoArea': 'ನಿಮ್ಮ ಸುತ್ತಮುತ್ತಲಿನ ಸಮಸ್ಯೆಗಳನ್ನು ನೋಡಲು ಸ್ಥಳವನ್ನು ಬಳಸಿ ಅಥವಾ ಪ್ರದೇಶ ಆಯ್ಕೆಮಾಡಿ.',
    'alerts.subClear': 'ಇಲ್ಲಿ ಏನೂ ವರದಿಯಾಗಿಲ್ಲ. ಪರಿಸ್ಥಿತಿ ಬದಲಾಗಬಹುದು, ಜಾಗ್ರತೆಯಿಂದಿರಿ.',
    'alerts.reportBtn': 'ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ',
    'alerts.useLocation': 'ನನ್ನ ಸ್ಥಳ ಬಳಸಿ',
    'alerts.allBengaluru': 'ಇಡೀ ಬೆಂಗಳೂರು',
    'alerts.noneInArea': 'ಈ ಸ್ಥಳದ {km} ಕಿ.ಮೀ ಒಳಗೆ ಏನೂ ಇಲ್ಲ. ನಗರದ ಬೇರೆಡೆ {everywhere} ಇವೆ.',
    'alerts.noneCity': 'ಪ್ರಸ್ತುತ ನಗರದಲ್ಲಿ ಯಾವುದೇ ಎಚ್ಚರಿಕೆಗಳಿಲ್ಲ.',
    'alerts.seeWholeCity': 'ಇಡೀ ನಗರ ನೋಡಿ',
    'alerts.loadSamples': 'ಮಾದರಿ ವರದಿಗಳನ್ನು ಲೋಡ್ ಮಾಡಿ',
    'alerts.removeSamples': 'ಮಾದರಿ ವರದಿಗಳನ್ನು ತೆಗೆಯಿರಿ',
    'alerts.iSeeThis': 'ನಾನೂ ಇದನ್ನು ನೋಡಿದ್ದೇನೆ',
    'alerts.counted': 'ಧನ್ಯವಾದಗಳು, ಎಣಿಸಲಾಗಿದೆ',
    'alerts.warnOthers': 'ಇತರರಿಗೆ ಎಚ್ಚರಿಸಿ',
    'alerts.openMap': 'ನಕ್ಷೆ ತೆರೆಯಿರಿ ↗',
    'alerts.readAloud': 'ಜೋರಾಗಿ ಓದಿ',
    'alerts.stop': 'ನಿಲ್ಲಿಸಿ',
    'alerts.speak': 'ಮಾತನಾಡಿ',
    'alerts.sayProblem': 'ಸಮಸ್ಯೆ ಹೇಳಿ',
    'alerts.listening': 'ಕೇಳಿಸಲಾಗುತ್ತಿದೆ… ಈಗ ಮಾತನಾಡಿ.',
    'alerts.disclaimer': 'ಇವು ನಾಗರಿಕರ ವರದಿಗಳಾಗಿವೆ, ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳಲ್ಲ. ತುರ್ತು ಸಂದರ್ಭದಲ್ಲಿ 112 ಕ್ಕೆ ಕರೆ ಮಾಡಿ.',
    'welcome.s1t': 'ಹೊರಡುವ ಮೊದಲು ಪರಿಶೀಲಿಸಿ',
    'welcome.s1b': 'ನಿಮ್ಮ ಸಮೀಪ ವರದಿಯಾದ ಪ್ರವಾಹ, ಟ್ರಾಫಿಕ್ ಮತ್ತು ರಸ್ತೆ ಸಮಸ್ಯೆಗಳನ್ನು ನೋಡಿ.',
    'welcome.s2t': 'ನೀವು ನೋಡಿದ್ದನ್ನು ವರದಿ ಮಾಡಿ',
    'welcome.s2b': 'ಸಮಸ್ಯೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ ಫೋಟೋ ಸೇರಿಸಿ. ಸಂಬಂಧಿತ ಇಲಾಖೆಯನ್ನು ನಾವು ತೋರಿಸುತ್ತೇವೆ.',
    'welcome.s3t': 'ಸ್ಥಿತಿ ಗಮನಿಸಿ',
    'welcome.s3b': 'ಇಲಾಖೆಗೆ ಕಳುಹಿಸಿ ಮತ್ತು ನನ್ನ ವರದಿಗಳಲ್ಲಿ ಪ್ರಗತಿಯನ್ನು ನೋಡಿ.',
    'welcome.gotIt': 'ಸರಿ, ಅರ್ಥವಾಯಿತು',

    // Report wizard
    'step.problem': 'ಸಮಸ್ಯೆ',
    'step.photo': 'ಫೋಟೋ',
    'step.place': 'ಸ್ಥಳ',
    'step.send': 'ಕಳುಹಿಸಿ',
    'report.whatProblem': 'ಸಮಸ್ಯೆ ಏನು?',
    'report.groupRoad': 'ರಸ್ತೆ ಮತ್ತು ಸಂಚಾರ',
    'report.groupWater': 'ನೀರು ಮತ್ತು ಮಳೆ',
    'report.groupPower': 'ವಿದ್ಯುತ್, ದೀಪ ಮತ್ತು ಕಸ',
    'report.emergency112': 'ಯಾರಾದರೂ ಅಪಾಯದಲ್ಲಿದ್ದರೆ ಮೊದಲು 112 ಕ್ಕೆ ಕರೆ ಮಾಡಿ.',
    'report.addPhoto': 'ಫೋಟೋ ಸೇರಿಸಿ',
    'report.photoLead': 'ಇಲಾಖೆಗೆ ಸಮಸ್ಯೆಯನ್ನು ಪತ್ತೆಹಚ್ಚಲು ಫೋಟೋ ಸಹಾಯ ಮಾಡುತ್ತದೆ. ಸುರಕ್ಷಿತ ಅಂತರ ಕಾಯ್ದುಕೊಳ್ಳಿ.',
    'report.takePhoto': 'ಫೋಟೋ ತೆಗೆಯಿರಿ',
    'report.takeAnother': 'ಇನ್ನೊಂದು ತೆಗೆಯಿರಿ',
    'report.chooseGallery': 'ಗ್ಯಾಲರಿಯಿಂದ ಆರಿಸಿ',
    'report.anythingElse': 'ಹೆಚ್ಚುವರಿ ವಿವರಗಳು (ಐಚ್ಛಿಕ)',
    'report.whereIsIt': 'ಇದು ಎಲ್ಲಿ ಇದೆ?',
    'report.jumpArea': 'ಪ್ರದೇಶಕ್ಕೆ ಹೋಗಿ…',
    'report.tapMap': 'ಈಗ ನಕ್ಷೆಯಲ್ಲಿ ನಿಖರವಾದ ಸ್ಥಳವನ್ನು ಒತ್ತಿ.',
    'report.checkSend': 'ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಕಳುಹಿಸಿ',
    'report.howSerious': 'ಎಷ್ಟು ಗಂಭೀರವಾಗಿದೆ?',
    'report.back': 'ಹಿಂದೆ',
    'report.next': 'ಮುಂದೆ',
    'report.skip': 'ಈಗ ಬಿಡಿ',
    'report.send': 'ವರದಿ ಕಳುಹಿಸಿ',
    'report.sending': 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…',
    'report.recorded': 'ವರದಿ ದಾಖಲಾಗಿದೆ',
    'report.seeMine': 'ನನ್ನ ವರದಿಗಳನ್ನು ನೋಡಿ',
    'report.sendAnother': 'ಮತ್ತೊಂದು ವರದಿ ಕಳುಹಿಸಿ',
    'report.needLogin': 'ವರದಿ ಕಳುಹಿಸಲು ಮತ್ತು ಅದನ್ನು ಹಿಂಬಾಲಿಸಲು ಲಾಗಿನ್ ಅಥವಾ ಸೈನ್ ಅಪ್ ಮಾಡಿ.',
    'report.needLoginBtn': 'ಲಾಗಿನ್ ಅಥವಾ ಸೈನ್ ಅಪ್',

    // Help / Maps / 3D / Chat
    'help.numbers': 'ಸಹಾಯವಾಣಿ ಸಂಖ್ಯೆಗಳು',
    'help.ask': 'ಪ್ರಶ್ನೆ ಕೇಳಿ',
    'help.settings': 'ಸೆಟ್ಟಿಂಗ್ಸ್',
    'help.users': 'ಬಳಕೆದಾರರು',
    'gmaps.title': 'ಲೈವ್ Google ನಕ್ಷೆ',
    'gmaps.myLocation': 'ನನ್ನ ಸ್ಥಳ',
    'gmaps.searchLabel': 'ಬೆಂಗಳೂರಿನಲ್ಲಿ ಸ್ಥಳ ಹುಡುಕಿ',
    'gmaps.routingTitle': 'ತುರ್ತು ಟ್ಯಾಂಕರ್ ಮಾರ್ಗ',
    'gmaps.computeRoute': 'ಟ್ರಾಫಿಕ್-ಸಹಿತ ಮಾರ್ಗ ಲೆಕ್ಕಿಸಿ',
    'gmaps.all': 'ಎಲ್ಲಾ',
    'gmaps.hospitals': 'ಆಸ್ಪತ್ರೆಗಳು',
    'gmaps.power': 'ವಿದ್ಯುತ್',
    'gmaps.water': 'ನೀರು',
    'gmaps.telecom': 'ಟೆಲಿಕಾಂ',
    'chat.askAi': 'AI ಕೇಳಿ',
  },
  'hi-IN': {
    // Nav & shell
    'nav.citizen': 'नागरिक अलर्ट',
    'nav.citizen.short': 'अलर्ट',
    'nav.officer.citizen': 'विभाग डेस्क',
    'nav.officer.citizen.short': 'डेस्क',
    'nav.gmaps': 'लाइव मैप',
    'nav.gmaps.short': 'मैप',
    'nav.cascade': 'कैस्केड विश्लेषण',
    'nav.cascade.short': 'विश्लेषण',
    'nav.help': 'सहायता और सेटिंग्स',
    'nav.help.short': 'सहायता',
    'auth.login': 'लॉग इन',
    'auth.logout': 'लॉग आउट',
    'auth.signup': 'साइन अप',
    'auth.guest': 'अतिथि',
    'theme.light': 'हल्का',
    'theme.dark': 'गहरा',
    'lang.label': 'भाषा',

    // Auth page
    'auth.tagline': 'आगे क्या विफल हो सकता है, पहले से देखें।',
    'auth.google': 'Google से जारी रखें (Firestore + Cloud SQL)',
    'auth.email': 'ईमेल',
    'auth.password': 'पासवर्ड',
    'auth.show': 'दिखाएँ',
    'auth.hide': 'छिपाएँ',
    'auth.guestBtn': 'बिना खाते के जारी रखें: अलर्ट और हेल्पलाइन नंबर देखें',
    'auth.demoTitle': 'डेमो खाते',
    'auth.demoHint': 'फ़ॉर्म भरने के लिए किसी पर टैप करें, फिर लॉग इन दबाएँ। डेमो के लिए केवल इस ब्राउज़र में सहेजा गया है।',
    'auth.emergency': 'आपातकाल में',
    'auth.createAccount': 'खाता बनाएँ',
    'auth.pleaseWait': 'कृपया प्रतीक्षा करें…',
    'auth.fullName': 'पूरा नाम',

    // Citizen tabs & alerts
    'tab.alerts': 'पास के अलर्ट',
    'tab.report': 'रिपोर्ट भेजें',
    'tab.mine': 'मेरी रिपोर्ट',
    'tab.grade': 'रेटिंग और सुझाव',
    'tab.desk': 'विभाग डेस्क',
    'tab.analysis': 'बुनियादी ढाँचा विश्लेषण',
    'tab.contractors': 'ठेकेदार रिपोर्ट',
    'alerts.sampleBar': 'सुविधा डेटा अभी नमूना है, इसलिए “अस्पताल के पास” बिंदु केवल प्रदर्शन के लिए हैं।',
    'alerts.noAlertsCity': 'शहर भर में कोई अलर्ट नहीं',
    'alerts.noAlertsRadius': '{km} किमी के भीतर कोई अलर्ट नहीं',
    'alerts.oneAlertCity': 'शहर में 1 अलर्ट',
    'alerts.manyAlertsCity': 'शहर में {n} अलर्ट',
    'alerts.oneAlertRadius': '{km} किमी के भीतर 1 अलर्ट',
    'alerts.manyAlertsRadius': '{km} किमी के भीतर {n} अलर्ट',
    'alerts.subHaveArea': 'निकलने से पहले अपना रास्ता जाँचने के लिए मानचित्र पर टैप करें।',
    'alerts.subNoArea': 'अपने आस-पास की स्थिति देखने के लिए लोकेशन चुनें या क्षेत्र चुनें।',
    'alerts.subClear': 'यहाँ अभी कुछ रिपोर्ट नहीं हुआ है। स्थिति बदल सकती है, सावधान रहें।',
    'alerts.reportBtn': 'समस्या की रिपोर्ट करें',
    'alerts.useLocation': 'मेरी लोकेशन उपयोग करें',
    'alerts.allBengaluru': 'पूरा बेंगलुरु',
    'alerts.noneInArea': 'इस स्थान के {km} किमी के भीतर कुछ नहीं। शहर में अन्यत्र {everywhere} अलर्ट हैं।',
    'alerts.noneCity': 'फिलहाल शहर में कहीं कोई अलर्ट नहीं है।',
    'alerts.seeWholeCity': 'पूरा शहर देखें',
    'alerts.loadSamples': 'नमूना रिपोर्ट लोड करें',
    'alerts.removeSamples': 'नमूना रिपोर्ट हटाएँ',
    'alerts.iSeeThis': 'मैंने भी यह देखा है',
    'alerts.counted': 'धन्यवाद, गिना गया',
    'alerts.warnOthers': 'दूसरों को चेतावनी दें',
    'alerts.openMap': 'मैप खोलें ↗',
    'alerts.readAloud': 'ज़ोर से पढ़ें',
    'alerts.stop': 'रोकें',
    'alerts.speak': 'बोलें',
    'alerts.sayProblem': 'समस्या बोलें',
    'alerts.listening': 'सुन रहे हैं… अब बोलें।',
    'alerts.disclaimer': 'ये नागरिकों की रिपोर्ट हैं, आधिकारिक चेतावनी नहीं। आपात स्थिति में 112 पर कॉल करें।',
    'welcome.s1t': 'निकलने से पहले जाँचें',
    'welcome.s1b': 'अपने पास लोगों द्वारा रिपोर्ट की गई बाढ़, ट्रैफिक और सड़क समस्याओं को देखें।',
    'welcome.s2t': 'जो देखें उसकी रिपोर्ट करें',
    'welcome.s2b': 'समस्या चुनें और फोटो जोड़ें। हम जिम्मेदार विभाग बताते हैं।',
    'welcome.s3t': 'प्रगति देखें',
    'welcome.s3b': 'विभाग को भेजें और मेरी रिपोर्ट में स्थिति देखें।',
    'welcome.gotIt': 'समझ गया',

    // Report wizard
    'step.problem': 'समस्या',
    'step.photo': 'फोटो',
    'step.place': 'स्थान',
    'step.send': 'भेजें',
    'report.whatProblem': 'समस्या क्या है?',
    'report.groupRoad': 'सड़क और यातायात',
    'report.groupWater': 'पानी और बारिश',
    'report.groupPower': 'बिजली, लाइट और कचरा',
    'report.emergency112': 'यदि कोई खतरे में है, तो पहले 112 पर कॉल करें।',
    'report.addPhoto': 'फोटो जोड़ें',
    'report.photoLead': 'फोटो विभाग को समस्या खोजने और ठीक करने में मदद करती है। सुरक्षित दूरी रखें।',
    'report.takePhoto': 'फोटो खींचें',
    'report.takeAnother': 'दूसरी खींचें',
    'report.chooseGallery': 'गैलरी से चुनें',
    'report.anythingElse': 'कुछ और जोड़ना है? (वैकल्पिक)',
    'report.whereIsIt': 'यह कहाँ है?',
    'report.jumpArea': 'किसी क्षेत्र पर जाएँ…',
    'report.tapMap': 'अब मानचित्र पर सटीक स्थान टैप करें।',
    'report.checkSend': 'जाँचें और भेजें',
    'report.howSerious': 'यह कितना गंभीर है?',
    'report.back': 'पीछे',
    'report.next': 'आगे',
    'report.skip': 'अभी छोड़ें',
    'report.send': 'रिपोर्ट भेजें',
    'report.sending': 'भेजा जा रहा है…',
    'report.recorded': 'रिपोर्ट दर्ज हो गई',
    'report.seeMine': 'मेरी रिपोर्ट देखें',
    'report.sendAnother': 'एक और रिपोर्ट भेजें',
    'report.needLogin': 'रिपोर्ट भेजने और उसकी स्थिति देखने के लिए लॉग इन या साइन अप करें।',
    'report.needLoginBtn': 'लॉग इन या साइन अप',

    // Help / Maps / 3D / Chat
    'help.numbers': 'हेल्पलाइन नंबर',
    'help.ask': 'सवाल पूछें',
    'help.settings': 'सेटिंग्स',
    'help.users': 'उपयोगकर्ता',
    'gmaps.title': 'लाइव Google मैप',
    'gmaps.myLocation': 'मेरी लोकेशन',
    'gmaps.searchLabel': 'बेंगलुरु में स्थान खोजें',
    'gmaps.routingTitle': 'आपातकालीन टैंकर रूटिंग',
    'gmaps.computeRoute': 'ट्रैफिक-सचेत मार्ग निकालें',
    'gmaps.all': 'सभी',
    'gmaps.hospitals': 'अस्पताल',
    'gmaps.power': 'बिजली',
    'gmaps.water': 'पानी',
    'gmaps.telecom': 'टेलीकॉम',
    'chat.askAi': 'AI से पूछें',
  },
};

const TR_CATEGORIES: Record<AppLang, Record<string, string>> = {
  'en-IN': {},
  'kn-IN': {
    pothole: 'ರಸ್ತೆ ಗುಂಡಿ / ಹಾನಿ',
    flood: 'ಪ್ರವಾಹ / ನೀರು ನಿಂತಿದೆ',
    water_leak: 'ನೀರು ಸೋರಿಕೆ / ಪೈಪ್ ಒಡೆದಿದೆ',
    no_water: 'ನೀರು ಪೂರೈಕೆ ಇಲ್ಲ',
    sewage: 'ಒಳಚರಂಡಿ ಉಕ್ಕಿ ಹರಿಯುತ್ತಿದೆ',
    power_line: 'ತಂತಿ ಬಿದ್ದಿದೆ / ವಿದ್ಯುತ್ ದೋಷ',
    transmission: 'ಹೈ-ವೋಲ್ಟೇಜ್ ಟವರ್ / ಲೈನ್',
    street_light: 'ಬೀದಿ ದೀಪ ಉರಿಯುತ್ತಿಲ್ಲ',
    garbage: 'ಕಸ ವಿಲೇವಾರಿ ಆಗಿಲ್ಲ',
    fallen_tree: 'ಮರ / ಕೊಂಬೆ ಬಿದ್ದಿದೆ',
    signal: 'ಟ್ರಾಫಿಕ್ ಸಿಗ್ನಲ್ ದೋಷ',
    heavy_rain: 'ಭಾರಿ ಮಳೆ',
    traffic: 'ಭಾರಿ ಟ್ರಾಫಿಕ್',
  },
  'hi-IN': {
    pothole: 'सड़क पर गड्ढा / क्षति',
    flood: 'बाढ़ / जलभराव',
    water_leak: 'पानी रिसाव / पाइप फटना',
    no_water: 'पानी की सप्लाई नहीं',
    sewage: 'सीवर ओवरफ्लो',
    power_line: 'तार गिरा / बिजली खराबी',
    transmission: 'हाई-वोल्टेज टावर / लाइन',
    street_light: 'स्ट्रीट लाइट खराब',
    garbage: 'कचरा साफ नहीं हुआ',
    fallen_tree: 'पेड़ / डाली गिरी',
    signal: 'ट्रैफिक सिग्नल खराबी',
    heavy_rain: 'तेज़ बारिश',
    traffic: 'भारी ट्रैफिक',
  },
};

const TR_BANDS: Record<AppLang, Record<string, string>> = {
  'en-IN': {},
  'kn-IN': { critical: 'ಅತ್ಯಂತ ಗಂಭೀರ', high: 'ಹೆಚ್ಚು', medium: 'ಮಧ್ಯಮ', low: 'ಕಡಿಮೆ' },
  'hi-IN': { critical: 'अति गंभीर', high: 'उच्च', medium: 'मध्यम', low: 'कम' },
};

const TR_HAZARDS: Record<AppLang, Record<string, string>> = {
  'en-IN': {},
  'kn-IN': {
    low: 'ಕಡಿಮೆ — ತೊಂದರೆ ಮಾತ್ರ',
    medium: 'ಮಧ್ಯಮ — ರಸ್ತೆ ಅಥವಾ ಪೂರೈಕೆಗೆ ಅಡ್ಡಿ',
    high: 'ಹೆಚ್ಚು — ಈಗಲೇ ಯಾರಿಗಾದರೂ ಅಪಾಯ',
  },
  'hi-IN': {
    low: 'कम — केवल असुविधा',
    medium: 'मध्यम — रास्ता या सप्लाई बाधित',
    high: 'उच्च — अभी किसी को खतरा',
  },
};

const TR_ADVICE: Record<AppLang, Record<string, string>> = {
  'en-IN': {},
  'kn-IN': {
    pothole: 'ಇಲ್ಲಿ ನಿಧಾನವಾಗಿ ಚಲಿಸಿ, ವಿಶೇಷವಾಗಿ ದ್ವಿಚಕ್ರ ವಾಹನದಲ್ಲಿ ಅಥವಾ ರಾತ್ರಿ ಹೊತ್ತು.',
    flood: 'ಸಾಧ್ಯವಾದರೆ ಈ ರಸ್ತೆ ಬಳಸಬೇಡಿ. ನಿಂತ ನೀರಿನಲ್ಲಿ ನಡೆಯಬೇಡಿ ಅಥವಾ ವಾಹನ ಚಲಾಯಿಸಬೇಡಿ.',
    heavy_rain: 'ತಗ್ಗು ರಸ್ತೆಗಳು ಮತ್ತು ಅಂಡರ್‌ಪಾಸ್‌ಗಳಲ್ಲಿ ಶೀಘ್ರದಲ್ಲೇ ನೀರು ತುಂಬಬಹುದು.',
    traffic: 'ವಿಳಂಬ ನಿರೀಕ್ಷಿಸಿ. ಸಾಧ್ಯವಾದರೆ ಬೇರೆ ಮಾರ್ಗ ಆರಿಸಿ.',
    power_line: 'ದೂರ ಇರಿ ಮತ್ತು ತಂತಿಯ ಹತ್ತಿರ ಯಾವುದನ್ನೂ ಮುಟ್ಟಬೇಡಿ.',
    transmission: 'ಟವರ್ ಮತ್ತು ಬಿದ್ದ ತಂತಿಯಿಂದ ದೂರ ಇರಿ.',
    sewage: 'ನಡೆಯುವಾಗ ಎಚ್ಚರವಹಿಸಿ, ಮ್ಯಾನ್‌ಹೋಲ್ ತೆರೆದಿರಬಹುದು.',
    fallen_tree: 'ರಸ್ತೆ ಭಾಗಶಃ ಮುಚ್ಚಿರಬಹುದು. ಸಾಧ್ಯವಾದರೆ ಬೇರೆ ಮಾರ್ಗ ಆರಿಸಿ.',
    signal: 'ಸಿಗ್ನಲ್ ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ. ಜಂಕ್ಷನ್‌ನಲ್ಲಿ ಎಚ್ಚರವಹಿಸಿ.',
  },
  'hi-IN': {
    pothole: 'यहाँ धीरे चलें, खासकर दोपहिया वाहन पर या रात में।',
    flood: 'हो सके तो इस सड़क से न जाएँ। भरे पानी में न चलें और न गाड़ी चलाएँ।',
    heavy_rain: 'निचली सड़कों और अंडरपास में जल्द पानी भर सकता है।',
    traffic: 'देरी हो सकती है। हो सके तो दूसरा रास्ता चुनें।',
    power_line: 'दूर रहें और तार के पास किसी चीज़ को न छुएँ।',
    transmission: 'टावर और गिरे हुए तार से दूर रहें।',
    sewage: 'पैदल चलते समय सावधान रहें, मैनहोल खुला हो सकता है।',
    fallen_tree: 'सड़क आंशिक रूप से बंद हो सकती है। हो सके तो दूसरा रास्ता चुनें।',
    signal: 'सिग्नल काम नहीं कर रहा। चौराहे पर सावधान रहें।',
  },
};

export function tr(lang: AppLang, key: string, vars?: Record<string, string | number>): string {
  const norm = normalizeLang(lang);
  let out = STRINGS[norm]?.[key] ?? STRINGS['en-IN'][key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return out;
}

export function trCategory(lang: AppLang, id: string, fallback: string): string {
  return TR_CATEGORIES[normalizeLang(lang)]?.[id] || fallback;
}

export function trBand(lang: AppLang, id: string, fallback: string): string {
  return TR_BANDS[normalizeLang(lang)]?.[id] || fallback;
}

export function trHazard(lang: AppLang, id: string, fallback: string): string {
  return TR_HAZARDS[normalizeLang(lang)]?.[id] || fallback;
}

export function trAdvice(lang: AppLang, categoryId: string, fallback: string): string {
  return TR_ADVICE[normalizeLang(lang)]?.[categoryId] || fallback;
}
