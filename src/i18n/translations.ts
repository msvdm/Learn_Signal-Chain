export type Lang = 'en' | 'bg'

export interface TheoryEntry {
  what: string
  why: string
  tip: string
}

export interface Translations {
  app: {
    title: string
    tagline: string
    resetButton: string
    resetConfirm: string
    settings: string
    languages: { en: string; bg: string }
  }
  levels: {
    beginner:     { title: string; description: string }
    intermediate: { title: string; description: string }
    advanced:     { title: string; description: string }
    switchConfirm: string
  }
  meters: { input: string; output: string }
  health: { 'too-quiet': string; good: string; hot: string; clipping: string }
  warnings: {
    preampTooQuiet: string
    preampClipping: string
    eqClipping: string
    heavyCompression: string
    masterClipping: string
    masterTooQuiet: string
  }
  tooltip: {
    whatIsThis: string
    whyIsItHere: string
    proTip: string
    next: string
    finishTour: string
  }
  banner: { gainStaging: string }
  nodes: {
    mic: { label: string; sensitivity: string; micInfo: string }
    preamp: { label: string; gain: string }
    hpf: { label: string; cutoff: string }
    eq: {
      label: string
      curvePreview: string
      openCurve: string
      bandLow: string
      bandMid: string
      bandHigh: string
    }
    graphicEq: { label: string }
    comp: {
      label: string
      threshold: string
      ratio: string
      makeupGain: string
      gainReduction: string
    }
    fader: { label: string; unity: string }
    master: {
      label: string
      outputTrim: string
      statusGood: string
      statusHot: string
      statusClipping: string
      statusQuiet: string
    }
    speaker: {
      label: string
      signalIn: string
      statusGood: string
      statusHot: string
      statusClipping: string
      statusQuiet: string
      needsAmp: string
    }
    activeSpeaker: {
      label: string
      volume: string
    }
  }
  eqCurve: { title: string; subtitle: string; band: string }
  nodeControls: {
    bypass: string
    bypassed: string
    remove: string
  }
  theory: Record<string, TheoryEntry>
}

export const translations: Record<Lang, Translations> = {
  en: {
    app: {
      title: 'Learn Signal Chain',
      tagline: 'From microphone to speaker',
      resetButton: 'Reset to defaults',
      resetConfirm: 'Reset all controls to default values?',
      settings: 'Settings',
      languages: { en: 'English', bg: 'Български' },
    },
    levels: {
      beginner: {
        title: 'Beginner',
        description: 'Simple chain: microphone → preamp → EQ → compressor → speaker.',
      },
      intermediate: {
        title: 'Intermediate',
        description: 'Full chain including channel fader and master bus.',
      },
      advanced: {
        title: 'Advanced',
        description: 'Full chain with all processing stages.',
      },
      switchConfirm: 'Switch to {title}? This will reset all controls to defaults.',
    },
    meters: { input: 'Input', output: 'Output' },
    health: {
      'too-quiet': 'Too Quiet',
      good: 'Good',
      hot: 'Hot',
      clipping: 'Clipping!',
    },
    warnings: {
      preampTooQuiet:
        'Preamp output is too quiet. Increase gain to bring the signal into the green zone.',
      preampClipping:
        'Preamp is clipping! Reduce the gain — you are adding distortion before anything else can help.',
      eqClipping:
        'EQ is boosting the signal into clipping. Reduce EQ boost or lower preamp gain.',
      heavyCompression:
        'Heavy compression: {amount} dB of gain reduction. The signal may sound pumped or squashed.',
      masterClipping:
        'Master output is clipping. Lower the fader or master trim to prevent distortion.',
      masterTooQuiet: 'Master output is too quiet. Increase gain earlier in the chain.',
    },
    tooltip: {
      whatIsThis: 'What is this?',
      whyIsItHere: 'Why is it here?',
      proTip: 'Pro tip',
      next: 'Next',
      finishTour: 'Finish Tour',
    },
    banner: { gainStaging: 'Gain Staging' },
    nodes: {
      mic: {
        label: 'Microphone',
        sensitivity: 'Sensitivity',
        micInfo: 'Dynamic mic output: approx. -60 dBu',
      },
      preamp: { label: 'Preamp / Gain', gain: 'Gain' },
      hpf: {
        label: 'High-Pass Filter',
        cutoff: 'Cutoff frequency',
      },
      eq: {
        label: 'Parametric EQ',
        curvePreview: 'EQ curve preview',
        openCurve: 'Open EQ Curve',
        bandLow: 'Low',
        bandMid: 'Mid',
        bandHigh: 'High',
      },
      graphicEq: {
        label: 'Graphic EQ',
      },
      comp: {
        label: 'Compressor',
        threshold: 'Threshold',
        ratio: 'Ratio',
        makeupGain: 'Makeup gain',
        gainReduction: 'Gain reduction',
      },
      fader: { label: 'Channel Fader', unity: 'Unity' },
      master: {
        label: 'Master Bus',
        outputTrim: 'Output trim',
        statusGood: 'Gain staging: Good',
        statusHot: 'Signal is hot — watch headroom',
        statusClipping: 'CLIPPING — reduce gain!',
        statusQuiet: 'Too quiet — increase gain',
      },
      speaker: {
        label: 'Speaker / Monitor',
        signalIn: 'Signal in',
        statusGood: 'Clean output',
        statusHot: 'Loud — near limit',
        statusClipping: 'Distortion! Signal clipping',
        statusQuiet: 'Too quiet — noise audible',
        needsAmp: 'Needs a power amplifier — connect an Amp node before this speaker',
      },
      activeSpeaker: {
        label: 'Active Speaker',
        volume: 'Volume',
      },
    },
    eqCurve: {
      title: 'EQ Curve',
      subtitle: 'Drag the colored handles to shape the frequency response',
      band: 'Band',
    },
    nodeControls: {
      bypass: 'Bypass',
      bypassed: 'Bypassed — signal passes through unchanged',
      remove: 'Remove from chain',
    },
    theory: {
      mic: {
        what: 'The microphone converts sound (acoustic energy) into an electrical signal. It outputs a very weak voltage — typically around -60 dBu for a dynamic microphone.',
        why: 'Everything starts here. The quality and placement of the microphone determines the raw material for the entire signal chain. A good source signal makes everything downstream easier.',
        tip: "The signal is in the blue (too quiet) zone — that is completely normal and expected at this stage. The preamp's job is to fix that.",
      },
      'line-in': {
        what: 'A line input accepts signals that are already at "line level" — roughly -10 dBu for consumer gear, +4 dBu for professional gear. This is the standard level used between devices: from a keyboard, audio interface, or effects unit into a mixer.',
        why: 'Line-level signals are strong enough to drive mixing and processing gear directly without a preamp. They sit well above the noise floor and well below the clipping point.',
        tip: 'If your line-level signal looks green (-40 to -12 dBu) you are good to go. If it is too quiet, the source device may have its own output level control — adjust that first before adding gain in the chain.',
      },
      instrument: {
        what: 'An instrument input (also called "Hi-Z" or high impedance) is designed for direct connection of guitars, basses, and similar passive pickups. The signal is louder than a microphone but still below true line level — typically -30 to -10 dBu.',
        why: 'Guitar pickups have a high output impedance. Connecting them to a standard line input or mic input causes tone loss (the high frequencies get loaded down). An instrument input has the correct impedance — 1 MΩ or more — to let the signal pass without colouring it.',
        tip: 'Going direct (DI) from an instrument bypasses the amp entirely. This is common in recording and live sound. A DI box can also be used to convert the high-impedance signal to a low-impedance balanced mic-level signal, which travels well over long cables.',
      },
      gain: {
        what: 'The preamp/gain stage boosts the input signal up to a usable working level. For a microphone, this can be +40 to +60 dB of gain. For a line-level source, you may only need +10 to +20 dB.',
        why: 'Without enough gain here, all downstream processors work with a weak signal and introduce more noise. Too much gain causes clipping before anything else in the chain can help. Getting this stage right is the foundation of gain staging.',
        tip: 'Aim for the output to land in the green zone (−40 to −12 dBu). This is called gain staging, and it starts right here.',
      },
      preamp: {
        what: 'The preamplifier (preamp) boosts the weak microphone-level signal up to "line level" — strong enough for the rest of the chain to work with. Typical gain: +20 to +60 dB.',
        why: 'Without enough gain here, all downstream processors — EQ, compressor, fader — work with a weak signal and introduce more noise. Too much gain causes distortion before anything else can help.',
        tip: 'Aim for the output to land in the green zone (-40 to -12 dBu). This is called gain staging, and it starts right here at the preamp.',
      },
      hpf: {
        what: 'The High-Pass Filter (HPF) removes frequencies below a chosen cutoff point. Everything below that frequency is rolled off — "blocked". Everything above it "passes" through unchanged.',
        why: 'Microphones and instruments pick up low-frequency rumble: air conditioning, footsteps, handling noise, mic stand vibration. These frequencies serve no musical purpose and just muddy the mix. The HPF cleans them up before they reach the EQ or compressor.',
        tip: 'For most vocals start at 80–120 Hz. For acoustic guitar, try 100–150 Hz. Never use HPF on a kick drum or bass — you\'ll cut the fundamental frequency you actually want. The curve display shows exactly which frequencies you\'re removing.',
      },
      eq: {
        what: 'The Parametric EQ shapes the tonal character of the signal by boosting or cutting specific frequency ranges. Each band targets a frequency area: Low (body), Mid (presence), High (air and clarity). Bell mode shapes a peak or dip; Shelf mode boosts or cuts everything above/below a corner frequency.',
        why: 'Every sound source has frequencies that help or hurt its purpose. A vocal may need less boxiness around 400 Hz, more presence at 3 kHz, and more air at 10 kHz. The EQ lets you sculpt that precisely.',
        tip: "EQ is mostly subtractive in professional practice — cut what you don't need rather than boosting everything. Boosting adds energy; cutting cleans up the mix. In Intermediate mode you can switch Low and High bands to Shelf for a smoother, more musical result.",
      },
      'graphic-eq': {
        what: 'The Graphic EQ divides the spectrum into fixed frequency bands (here: 10 bands, one per octave from 31 Hz to 16 kHz). Each band has its own fader — push it up to boost that octave, pull it down to cut.',
        why: 'Graphic EQs are found on the master output of PA systems as the final tool for correcting room acoustics — a sudden peak at 4 kHz, a resonant boom at 63 Hz. They are less precise than parametric EQs but faster to use for broad shaping.',
        tip: 'In live sound the graphic EQ on the master output is used mainly to prevent feedback and correct for the room, not to shape the mix. Keep moves gentle — small cuts (−3 to −6 dB) solve most problems. Large boosts cause feedback and distortion.',
      },
      comp: {
        what: 'The compressor reduces the dynamic range of the signal — it automatically turns down loud peaks and can be used with makeup gain to raise the overall level. It makes quiet parts relatively louder and loud parts relatively quieter.',
        why: 'Live performances and recordings have wide dynamic ranges. Without compression, loud notes clip and quiet notes get lost. Compression makes the signal more consistent and controlled.',
        tip: 'Watch the gain reduction meter. 2-6 dB of gain reduction is transparent and musical. More than 10 dB starts to sound pumped and squashed — which can be an effect in itself.',
      },
      fader: {
        what: 'The channel fader controls the volume of this signal as it enters the mix. Unity gain (0 dB) means the signal passes through unchanged. Moving it down attenuates the signal.',
        why: 'Every instrument in a mix needs to sit at the right level relative to everything else. The fader is how you set that balance. It is the primary mixing control.',
        tip: 'In a mix, most faders end up below unity. The art of mixing is in the relative balance between all channels, not in making each one as loud as possible.',
      },
      amp: {
        what: 'A power amplifier takes a line-level signal and boosts it to speaker-driving level — adding significant current, not just voltage. A passive speaker (one without a built-in amp) requires a power amplifier to produce any sound.',
        why: 'Line-level signals are powerful enough for mixing and processing, but not powerful enough to physically move a speaker cone. The power amp provides the current needed to do the work.',
        tip: 'Power amps are rated in watts. For studio monitors you typically need 50–100 W. For live PA systems, 500–2000 W per side is common. More wattage = more headroom before clipping, not necessarily more loudness.',
      },
      switch: {
        what: 'A switch (or mute button) is the simplest control in a signal chain. When it is on, the signal passes through unchanged. When it is off, the signal is completely cut — silence.',
        why: 'Muting is used to silence a channel between takes, to prevent feedback when a microphone is not in use, or to isolate a track during a mix.',
        tip: 'In live sound, muting microphones when not in use prevents bleed, handling noise, and feedback. It is a habit every sound engineer develops quickly.',
      },
      potentiometer: {
        what: 'A potentiometer (pot) is a variable resistor used as a volume or level control. It uses an audio taper curve, which matches how human hearing perceives loudness — most of the usable range is in the upper half of the knob rotation.',
        why: 'Audio equipment uses pots for volume controls, send levels, trim controls, and effects returns. The audio taper ensures that the control feels linear even though loudness is logarithmic.',
        tip: 'The 12 o\'clock position (50%) is not unity gain on an audio taper pot — unity is typically at 75% of the rotation. This node models that correctly: full CCW = silence, 75% = 0 dB, full CW = +10 dB.',
      },
      bus: {
        what: 'A bus (or auxiliary bus) collects signals from multiple channels and combines them into a single output. It is used for grouping, effects sends, monitor mixes, and submixes.',
        why: 'Grouping related channels (e.g., all drum channels) onto a bus lets you control their combined level with one fader. Effects sends use a bus to route a copy of multiple channels to a reverb or delay unit.',
        tip: 'Keep bus levels well below 0 dBu — each channel feeding the bus adds to the total, so with many inputs the bus output can be much louder than any individual channel.',
      },
      'master-bus': {
        what: 'The master bus is the final summing point where all channels are combined before the signal leaves the system. Every fader move, every processing decision, ultimately ends up here.',
        why: 'The master bus controls the overall output level. It is also the place for final mix bus processing — subtle compression or limiting to control peaks and add cohesion.',
        tip: 'Leave headroom on the master bus — ideally keep peaks below −6 dBu. This gives a mastering engineer (or limiter) room to work. A master bus that is already at 0 dBu has nowhere to go.',
      },
      master: {
        what: 'The master bus receives all channel signals mixed together. It is the final stage before the signal leaves the system. A small trim here adjusts the overall output level.',
        why: 'The master bus is where your final mix level is controlled. It also applies any final processing — in professional studios, subtle compression and limiting are applied here to glue the mix.',
        tip: 'Leave some headroom on the master bus — ideally peaks should not exceed -6 dBu. This leaves room for a mastering engineer (or limiter) to do their job without distortion.',
      },
      speaker: {
        what: 'A passive speaker converts electrical signal back into sound, but it has no built-in amplifier. It needs a separate power amplifier (Amp node) to drive it — connecting one directly to line level will produce no sound.',
        why: 'Passive speakers are the standard in live sound PA systems and hi-fi setups. The amplifier is a separate unit chosen for its power output and impedance matching to the speaker.',
        tip: 'Connect an Amp node before this speaker. The amplifier provides the current needed to physically move the speaker cone. Without it, the signal is there but nothing moves.',
      },
      'active-speaker': {
        what: 'An active (powered) speaker has a built-in amplifier. It accepts line-level signals directly from a mixer, audio interface, or any line-level output — no separate power amp needed.',
        why: 'Active speakers are the standard in modern studio monitors and portable PA setups. The built-in amplifier is matched to the speaker driver, which is why powered monitors tend to have more consistent, accurate sound.',
        tip: 'The volume knob adjusts the final output level. Good gain staging means getting a healthy green signal to this speaker — then use the volume knob to set how loud you want to listen, not to compensate for a too-quiet or too-loud chain.',
      },
    },
  },

  bg: {
    app: {
      title: 'Научи Сигналната Верига',
      tagline: 'От микрофон до говорител',
      resetButton: 'Нулирай настройките',
      resetConfirm: 'Нулиране на всички контроли към стойностите по подразбиране?',
      settings: 'Настройки',
      languages: { en: 'English', bg: 'Български' },
    },
    levels: {
      beginner: {
        title: 'Начинаещ',
        description: 'Проста верига: микрофон → предусилвател → EQ → компресор → говорител.',
      },
      intermediate: {
        title: 'Средно ниво',
        description: 'Пълна верига с канален фейдър и мастър бус.',
      },
      advanced: {
        title: 'Напреднал',
        description: 'Пълна верига с всички обработващи стъпала.',
      },
      switchConfirm:
        'Превключване към {title}? Всички контроли ще се нулират.',
    },
    meters: { input: 'Вход', output: 'Изход' },
    health: {
      'too-quiet': 'Прекалено тихо',
      good: 'Добре',
      hot: 'Горещо',
      clipping: 'Изкривяване!',
    },
    warnings: {
      preampTooQuiet:
        'Изходът на предусилвателя е прекалено тих. Увеличи усилването, за да доведеш сигнала в зелената зона.',
      preampClipping:
        'Предусилвателят изкривява! Намали усилването — добавяш изкривяване преди всичко останало да може да помогне.',
      eqClipping:
        'Еквалайзерът усилва сигнала до изкривяване. Намали усилването на еквалайзера или намали усилването на предусилвателя.',
      heavyCompression:
        'Тежка компресия: {amount} dB намаление на усилването. Сигналът може да звучи помпащо или смачкано.',
      masterClipping:
        'Изходът на мастъра изкривява. Намали фейдъра или изходното изравняване, за да предотвратиш изкривяване.',
      masterTooQuiet:
        'Изходът на мастъра е прекалено тих. Увеличи усилването по-рано в веригата.',
    },
    tooltip: {
      whatIsThis: 'Какво е това?',
      whyIsItHere: 'Защо е тук?',
      proTip: 'Съвет от про',
      next: 'Напред',
      finishTour: 'Край на обиколката',
    },
    banner: { gainStaging: 'Стъпалост на усилването' },
    nodes: {
      mic: {
        label: 'Микрофон',
        sensitivity: 'Чувствителност',
        micInfo: 'Изход на динамичен микрофон: приблизително -60 dBu',
      },
      preamp: { label: 'Предусилвател', gain: 'Усилване' },
      hpf: {
        label: 'Високочестотен филтър',
        cutoff: 'Честота на прекъсване',
      },
      eq: {
        label: 'Параметричен EQ',
        curvePreview: 'Преглед на EQ кривата',
        openCurve: 'Отвори EQ Кривата',
        bandLow: 'Ниски',
        bandMid: 'Средни',
        bandHigh: 'Високи',
      },
      graphicEq: {
        label: 'Графичен EQ',
      },
      comp: {
        label: 'Компресор',
        threshold: 'Праг',
        ratio: 'Отношение',
        makeupGain: 'Компенсиращо усилване',
        gainReduction: 'Намаление на усилването',
      },
      fader: { label: 'Канален Фейдър', unity: 'Единица' },
      master: {
        label: 'Мастър Бус',
        outputTrim: 'Изходно изравняване',
        statusGood: 'Стъпалост: Добре',
        statusHot: 'Сигналът е горещ — внимавай за запас',
        statusClipping: 'КЛИПИРА — намали усилването!',
        statusQuiet: 'Прекалено тихо — увеличи усилването',
      },
      speaker: {
        label: 'Говорител / Монитор',
        signalIn: 'Входен сигнал',
        statusGood: 'Чист изход',
        statusHot: 'Силно — близо до лимита',
        statusClipping: 'Изкривяване! Сигналът клипира',
        statusQuiet: 'Прекалено тихо — шумът ще е чуваем',
        needsAmp: 'Нужен е усилвател — свържете Amp възел преди тази тонколона',
      },
      activeSpeaker: {
        label: 'Активна тонколона',
        volume: 'Сила на звука',
      },
    },
    eqCurve: {
      title: 'EQ Крива',
      subtitle: 'Плъзни цветните дръжки, за да оформиш честотния отговор',
      band: 'Лента',
    },
    nodeControls: {
      bypass: 'Байпас',
      bypassed: 'Байпас — сигналът минава без промяна',
      remove: 'Премахни от веригата',
    },
    theory: {
      mic: {
        what: 'Микрофонът преобразува звука (акустична енергия) в електрически сигнал. Той изхожда много слабо напрежение — обикновено около -60 dBu за динамичен микрофон.',
        why: 'Всичко започва тук. Качеството и позицията на микрофона определят суровия материал за цялата сигнална верига. Добрият изходен сигнал прави всичко надолу по веригата по-лесно.',
        tip: 'Сигналът е в синята (прекалено тиха) зона — това е напълно нормално и очаквано на този етап. Задачата на предусилвателя е да го поправи.',
      },
      'line-in': {
        what: 'Линейният вход приема сигнали, които вече са на "линейно ниво" — приблизително -10 dBu за потребителска техника, +4 dBu за професионална. Това е стандартното ниво между устройствата: от клавиатура, аудио интерфейс или ефект-процесор към миксер.',
        why: 'Линейните сигнали са достатъчно силни за директно смесване и обработка без предусилвател. Те са далеч над шумовия праг и под точката на клипиране.',
        tip: 'Ако линейният сигнал е зелен (-40 до -12 dBu), всичко е наред. Ако е прекалено тих, изходното ниво на изходното устройство може да има собствен регулатор — регулирай него първо.',
      },
      instrument: {
        what: 'Инструменталният вход (Hi-Z или висок импеданс) е предназначен за директно свързване на китари, баси и подобни пасивни звукосниматели. Сигналът е по-силен от микрофон, но под линейно ниво — обикновено от -30 до -10 dBu.',
        why: 'Китарните звукосниматели имат висок изходен импеданс. Свързването им към стандартен линеен или микрофонен вход причинява загуба на тон. Инструменталният вход има правилния импеданс — 1 МΩ или повече.',
        tip: 'Директното включване (DI) на инструмент заобикаля усилвателя изцяло. Кутия за директно включване (DI box) преобразува сигнала с висок импеданс в балансиран микрофонен сигнал с нисък импеданс.',
      },
      gain: {
        what: 'Предусилвателят/регулаторът на усилване усилва входния сигнал до работно ниво. За микрофон това може да е от +40 до +60 dB усилване. За линеен сигнал може да са нужни само +10 до +20 dB.',
        why: 'Без достатъчно усилване тук, всички следващи процесори работят със слаб сигнал и въвеждат повече шум. Прекалено много усилване причинява клипиране преди нещо друго да може да помогне.',
        tip: 'Цели изходът да е в зелената зона (от −40 до −12 dBu). Това се нарича стъпалост на усилването и започва точно тук.',
      },
      preamp: {
        what: 'Предусилвателят усилва слабия сигнал от микрофонно ниво до "линейно ниво" — достатъчно силен, за да работи останалата верига. Типично усилване: от +20 до +60 dB.',
        why: 'Без достатъчно усилване тук, всички следващи процесори — еквалайзер, компресор, фейдър — работят със слаб сигнал и въвеждат повече шум. Прекалено много усилване причинява изкривяване преди всичко останало да може да помогне.',
        tip: 'Цели изходът да е в зелената зона (от -40 до -12 dBu). Това се нарича стъпалост на усилването и започва точно тук, при предусилвателя.',
      },
      hpf: {
        what: 'Високочестотният филтър (HPF) премахва честотите под избрана точка на прекъсване. Всичко под нея се отрязва — "блокира се". Всичко над нея "преминава" непроменено.',
        why: 'Микрофоните и инструментите улавят нискочестотен шум: климатик, стъпки, вибрации от стойката. Тези честоти нямат музикална цел и само замърсяват микса. HPF ги почиства преди да достигнат EQ или компресора.',
        tip: 'За повечето вокали започни от 80–120 Hz. За акустична китара опитай 100–150 Hz. Никога не използвай HPF на бас барабан или бас — ще отрежеш основната честота, която всъщност искаш.',
      },
      eq: {
        what: 'Параметричният EQ оформя тоналния характер на сигнала. Всяка лента насочва честотна зона: Ниски (тяло), Средни (присъствие), Високи (въздух и яснота). Режим Bell оформя връх или яма; Shelf усилва или намалява всичко над/под ъглова честота.',
        why: 'Всеки звуков източник има честоти, които помагат или пречат. Вокалите може да се нуждаят от по-малко "кутия" около 400 Hz, повече присъствие при 3 kHz и повече въздух при 10 kHz.',
        tip: 'EQ е предимно субтрактивен в практиката — намали нежеланото, вместо да усилваш всичко. В средно ниво можеш да превключваш Ниски и Високи ленти към Shelf за по-плавен резултат.',
      },
      'graphic-eq': {
        what: 'Графичният EQ разделя спектъра на фиксирани честотни ленти (тук: 10 ленти, по една на октава от 31 Hz до 16 kHz). Всяка лента има свой фейдър — издърпай нагоре за усилване, надолу за намаляване.',
        why: 'Графичните EQ се намират на главния изход на озвучителни системи за корекция на акустиката на помещението — внезапен връх при 4 kHz, резонанс при 63 Hz.',
        tip: 'В живия звук графичният EQ на главния изход се използва главно за предотвратяване на обратна връзка и корекция на помещението. Дръж промените малки — малки намалявания (−3 до −6 dB) решават повечето проблеми.',
      },
      comp: {
        what: 'Компресорът намалява динамичния диапазон на сигнала — той автоматично намалява силните пикове и може да се използва с компенсиращо усилване за повишаване на общото ниво. Той прави тихите части относително по-силни, а силните — относително по-тихи.',
        why: 'Живите изпълнения и записите имат широк динамичен диапазон. Без компресия, силните ноти клипират, а тихите се губят. Компресията прави сигнала по-последователен и контролиран.',
        tip: 'Наблюдавай метъра за намаление на усилването. 2-6 dB намаление е прозрачно и музикално. Повече от 10 dB започва да звучи помпащо и смачкано — което може само по себе си да бъде ефект.',
      },
      fader: {
        what: 'Каналният фейдър контролира силата на звука на този сигнал, когато влиза в миксa. Единично усилване (0 dB) означава, че сигналът преминава непроменен. Намалянето го заглушава.',
        why: 'Всеки инструмент в миксa трябва да е на правилното ниво спрямо всичко останало. Фейдърът е начинът да зададеш този баланс. Той е основният контрол за миксиране.',
        tip: 'В миксa повечето фейдъри завършват под единичното ниво. Изкуството на миксирането е в относителния баланс между всички канали, а не в правенето на всеки от тях колкото се може по-силен.',
      },
      amp: {
        what: 'Крайният усилвател взима линеен сигнал и го усилва до ниво за задвижване на говорители — добавя значителен ток, а не само напрежение. Пасивен говорител (без вграден усилвател) изисква крайния усилвател, за да произведе звук.',
        why: 'Линейните сигнали са достатъчно силни за смесване и обработка, но не и за физическото движение на конуса на говорителя. Крайният усилвател осигурява необходимия ток.',
        tip: 'Крайните усилватели се оценяват в вата. За студийни монитори обикновено са нужни 50–100 W. За живи озвучителни системи — 500–2000 W на канал. Повече вата = повече запас преди клипиране.',
      },
      switch: {
        what: 'Превключвателят (или бутонът за заглушаване) е най-простият контрол в сигналната верига. Когато е включен, сигналът преминава непроменен. Когато е изключен, сигналът е напълно отрязан — тишина.',
        why: 'Заглушаването се използва за заглушаване на канал между записи, за предотвратяване на обратна връзка, когато микрофонът не се използва, или за изолиране на запис по време на миксиране.',
        tip: 'В живия звук заглушаването на микрофони, когато не се използват, предотвратява просмукване, шум от ръкохватката и обратна връзка.',
      },
      potentiometer: {
        what: 'Потенциометърът (пот) е променливо съпротивление, използвано като регулатор на ниво. Използва аудио крива, която съответства на начина, по който човешкото ухо възприема силата на звука.',
        why: 'Аудио оборудването използва потенциометри за регулатори на силата на звука, нива на изпращане и тримери. Аудио кривата гарантира, че управлението изглежда линейно, въпреки че силата на звука е логаритмична.',
        tip: 'Позицията 12 часа (50%) не е единично усилване при аудио потенциометър — единичното е обикновено при 75% от въртенето. Тук: пълно ляво = тишина, 75% = 0 dB, пълно дясно = +10 dB.',
      },
      bus: {
        what: 'Шината (или спомагателната шина) събира сигнали от множество канали и ги комбинира в един изход. Използва се за групиране, изпращане към ефекти, монитор миксове и субмиксове.',
        why: 'Групирането на свързани канали (например всички барабанни канали) върху шина ти позволява да контролираш комбинираното им ниво с един фейдър.',
        tip: 'Дръж нивата на шините далеч под 0 dBu — всеки канал, захранващ шината, добавя към общото, така че с много входове изходът може да е много по-силен от всеки отделен канал.',
      },
      'master-bus': {
        what: 'Мастър шината е последната точка на сумиране, където всички канали се комбинират преди сигналът да напусне системата. Всяко движение на фейдъра, всяко решение за обработка, в крайна сметка завършва тук.',
        why: 'Мастър шината контролира общото изходно ниво. Тя е и мястото за финална обработка — фина компресия или ограничаване за контрол на пиковете и добавяне на кохезия.',
        tip: 'Оставяй запас на мастър шината — пиковете в идеалния случай трябва да са под −6 dBu. Мастър шина, която вече е на 0 dBu, няма накъде да отиде.',
      },
      master: {
        what: 'Мастър бусът получава всички канални сигнали, смесени заедно. Той е последният етап преди сигналът да напусне системата. Малко изравняване тук регулира общото изходно ниво.',
        why: 'Мастър бусът е там, където се контролира финалното ниво на миксa. Той прилага и всяка финална обработка — в професионалните студия, тук се прилага фина компресия и ограничаване за "сплотяване" на миксa.',
        tip: 'Оставяй запас на мастър буса — пиковете в идеалния случай не трябва да надвишават -6 dBu. Това оставя място за мастеринг инженер (или ограничител) да си свърши работата без изкривяване.',
      },
      speaker: {
        what: 'Пасивният говорител преобразува електрически сигнал обратно в звук, но няма вграден усилвател. Нуждае се от отделен усилвател (Amp възел) — свързването директно към линейно ниво не произвежда звук.',
        why: 'Пасивните говорители са стандарт в живи озвучителни системи и hi-fi инсталации. Усилвателят е отделен блок, избран за мощността и съпротивлението му.',
        tip: 'Свържете Amp възел преди този говорител. Усилвателят осигурява тока, необходим за физическото движение на конуса. Без него сигналът е налице, но нищо не се движи.',
      },
      'active-speaker': {
        what: 'Активната (захранена) тонколона има вграден усилвател. Приема линейни сигнали директно от миксер, аудио интерфейс или всеки друг линеен изход — не е нужен отделен усилвател.',
        why: 'Активните тонколони са стандарт в съвременните студийни монитори и преносими PA системи. Вграденият усилвател е съчетан с говорителя, поради което захранените монитори имат по-консистентен и точен звук.',
        tip: 'Потенциометърът за сила на звука настройва финалното изходно ниво. Добрата стъпалост означава зелен сигнал до тази тонколона — след това използвай регулатора за сила на звука, за да зададеш желаната сила на слушане.',
      },
    },
  },
}

export function fmt(str: string, params: Record<string, string>): string {
  return str.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`)
}
