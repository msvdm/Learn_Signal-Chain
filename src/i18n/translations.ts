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
  palette: {
    connectTool: string
    elements: string
    categories: { source: string; processing: string; routing: string; output: string }
    items: Record<string, string>
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
    palette: {
      connectTool: 'Connect Tool',
      elements: 'Elements',
      categories: { source: 'Sources', processing: 'Processing', routing: 'Routing', output: 'Output' },
      items: {
        'mic': 'Microphone',
        'line-in': 'Line Input',
        'instrument': 'Instrument',
        'gain': 'Preamp / Gain',
        'fader': 'Fader',
        'hpf': 'High-Pass Filter',
        'eq': 'Parametric EQ',
        'comp': 'Compressor',
        'switch': 'Switch / Mute',
        'potentiometer': 'Potentiometer',
        'amp': 'Amplifier',
        'graphic-eq': 'Graphic EQ',
        'master-bus': 'Master Bus',
        'bus': 'Bus / Aux',
        'active-speaker': 'Active Speaker',
        'speaker': 'Speaker (passive)',
      },
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
      tagline: 'От микрофон до тонколона',
      resetButton: 'Върни по подразбиране',
      resetConfirm: 'Да се върнат ли всички контроли към началните стойности?',
      settings: 'Настройки',
      languages: { en: 'English', bg: 'Български' },
    },
    levels: {
      beginner: {
        title: 'Начинаещ',
        description: 'Проста верига: микрофон → предусилвател → EQ → компресор → тонколона.',
      },
      intermediate: {
        title: 'Средно ниво',
        description: 'По-пълна верига с канален фейдър и мастър бус.',
      },
      advanced: {
        title: 'Напреднал',
        description: 'Пълна верига с всички обработващи стъпала.',
      },
      switchConfirm: 'Да се премине към {title}? Всички контроли ще се върнат към началните стойности.',
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
        'Сигналът след предусилвателя е твърде тих. Увеличи усилването, докато не влезе в зелената зона.',
      preampClipping:
        'Предусилвателят изкривява! Намали усилването — внасяш изкривяване преди каквото и да е друго да може да помогне.',
      eqClipping:
        'EQ усилва сигнала до изкривяване. Намали усилването на EQ или свали усилването на предусилвателя.',
      heavyCompression:
        'Силна компресия: {amount} dB намаление на усилването. Сигналът може да звучи помпащо или смачкано.',
      masterClipping:
        'Изходът на мастъра изкривява. Свали фейдъра или изходното изравняване, за да избегнеш изкривяване.',
      masterTooQuiet:
        'Изходът на мастъра е твърде тих. Увеличи усилването по-рано във веригата.',
    },
    tooltip: {
      whatIsThis: 'Какво е това?',
      whyIsItHere: 'Защо е тук?',
      proTip: 'Съвет от практиката',
      next: 'Напред',
      finishTour: 'Затвори обиколката',
    },
    banner: { gainStaging: 'Стъпалост на усилването' },
    nodes: {
      mic: {
        label: 'Микрофон',
        sensitivity: 'Чувствителност',
        micInfo: 'Изход на динамичен микрофон: около -60 dBu',
      },
      preamp: { label: 'Предусилвател', gain: 'Усилване' },
      hpf: {
        label: 'Нискочестотен заграждащ филтър',
        cutoff: 'Гранична честота',
      },
      eq: {
        label: 'Параметричен EQ',
        curvePreview: 'Преглед на EQ кривата',
        openCurve: 'Покажи EQ кривата',
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
        ratio: 'Степен на компресия',
        makeupGain: 'Компенсиращо усилване',
        gainReduction: 'Намаление на усилването',
      },
      fader: { label: 'Канален фейдър', unity: 'Нула (0 dB)' },
      master: {
        label: 'Мастър бус',
        outputTrim: 'Изходно изравняване',
        statusGood: 'Стъпалост: добре',
        statusHot: 'Сигналът е горещ — пази запас',
        statusClipping: 'КЛИПИРА — намали усилването!',
        statusQuiet: 'Твърде тихо — увеличи усилването',
      },
      speaker: {
        label: 'Тонколона / монитор',
        signalIn: 'Входен сигнал',
        statusGood: 'Чист изход',
        statusHot: 'Силно — близо до границата',
        statusClipping: 'Изкривяване! Сигналът клипира',
        statusQuiet: 'Твърде тихо — шумът ще е чуваем',
        needsAmp: 'Нужен е усилвател — свържи Amp възел преди тази тонколона',
      },
      activeSpeaker: {
        label: 'Активна тонколона',
        volume: 'Сила на звука',
      },
    },
    eqCurve: {
      title: 'EQ крива',
      subtitle: 'Дърпай цветните дръжки, за да оформиш честотния отговор',
      band: 'Лента',
    },
    nodeControls: {
      bypass: 'Байпас',
      bypassed: 'Байпас — сигналът минава без промяна',
      remove: 'Премахни от веригата',
    },
    palette: {
      connectTool: 'Инструмент за свързване',
      elements: 'Елементи',
      categories: { source: 'Източници', processing: 'Обработка', routing: 'Маршрутизиране', output: 'Изход' },
      items: {
        'mic': 'Микрофон',
        'line-in': 'Линеен вход',
        'instrument': 'Инструмент',
        'gain': 'Предусилвател / усилване',
        'fader': 'Фейдър',
        'hpf': 'Нискочестотен заграждащ филтър',
        'eq': 'Параметричен EQ',
        'comp': 'Компресор',
        'switch': 'Превключвател / заглушаване',
        'potentiometer': 'Потенциометър',
        'amp': 'Усилвател',
        'graphic-eq': 'Графичен EQ',
        'master-bus': 'Мастър бус',
        'bus': 'Бус / Aux',
        'active-speaker': 'Активна тонколона',
        'speaker': 'Тонколона (пасивна)',
      },
    },
    theory: {
      mic: {
        what: 'Микрофонът превръща звука (акустична енергия) в електрически сигнал. Той дава много слабо напрежение — обикновено около -60 dBu при динамичен микрофон.',
        why: 'Всичко започва тук. Качеството и позицията на микрофона определят суровия материал за цялата верига. Добър сигнал от самото начало прави работата на всичко след него по-лесна.',
        tip: 'Нормално е сигналът да е в синята (твърде тиха) зона — точно това се очаква на този етап. Задачата на предусилвателя е да го изведе до работно ниво.',
      },
      'line-in': {
        what: 'Линейният вход приема сигнали, които вече са на "линейно ниво" — около -10 dBu за потребителска техника и +4 dBu за професионална. Това е стандартното ниво между устройства: от синтезатор, аудио интерфейс или ефект-процесор към миксер.',
        why: 'Линейните сигнали са достатъчно силни за директно смесване и обработка — без нужда от предусилвател. Те са добре над шумовия праг и добре под точката на изкривяване.',
        tip: 'Ако сигналът е в зелено (-40 до -12 dBu), всичко е наред. Ако е твърде тих, провери дали изходното устройство има собствен регулатор на ниво — настрой го там, преди да добавяш усилване по-нататък.',
      },
      instrument: {
        what: 'Инструменталният вход (Hi-Z или висок импеданс) е предназначен за директно включване на китари, баси и подобни пасивни звукосниматели. Сигналът е по-силен от микрофон, но все още под линейно ниво — обикновено от -30 до -10 dBu.',
        why: 'Китарните звукосниматели имат висок изходен импеданс. Включени в стандартен линеен или микрофонен вход, те губят тон — особено високите честоти. Инструменталният вход има правилния импеданс (1 МΩ и повече), за да пропуска сигнала без оцветяване.',
        tip: 'Директното включване (DI) на инструмент заобикаля усилвателя изцяло — стандартна практика при запис и живо озвучаване. DI кутия превръща сигнала с висок импеданс в балансиран микрофонен сигнал, който пътува добре по дълги кабели.',
      },
      gain: {
        what: 'Предусилвателят усилва входния сигнал до работно ниво. За микрофон това може да са от +40 до +60 dB усилване. За линеен сигнал обикновено са нужни само +10 до +20 dB.',
        why: 'Без достатъчно усилване тук всички следващи процесори работят с нисък сигнал и внасят повече шум. Прекалено много усилване пък предизвиква изкривяване, преди каквото и да е друго да може да помогне. Правилното задаване на това ниво е основата на стъпалостта на усилването.',
        tip: 'Цели изходът да попадне в зелената зона (от -40 до -12 dBu). Именно това се нарича стъпалост на усилването — и тя започва точно тук.',
      },
      preamp: {
        what: 'Предусилвателят вдига слабия микрофонен сигнал до "линейно ниво" — достатъчно силен, за да работи останалата верига нормално. Типично усилване: от +20 до +60 dB.',
        why: 'Без достатъчно усилване тук всички следващи процесори — EQ, компресор, фейдър — работят с нисък сигнал и внасят повече шум. Прекалено много усилване причинява изкривяване, преди каквото и да е друго да може да помогне.',
        tip: 'Цели изходът да попадне в зелената зона (от -40 до -12 dBu). Именно това се нарича стъпалост на усилването — и тя започва точно тук, при предусилвателя.',
      },
      hpf: {
        what: 'Нискочестотният заграждащ филтър (HPF) премахва честотите под зададена гранична точка. Всичко под нея се отрязва. Всичко над нея преминава непроменено.',
        why: 'Микрофоните и инструментите улавят нискочестотни смущения: климатик, стъпки, вибрации от стойката. Тези честоти нямат музикална стойност и само замърсяват звука. HPF ги почиства, преди сигналът да достигне EQ или компресора.',
        tip: 'За повечето вокали започни от 80–120 Hz. За акустична китара опитай 100–150 Hz. Никога не слагай HPF на бас барабан или бас — ще отрежеш именно честотите, които искаш да чуеш.',
      },
      eq: {
        what: 'Параметричният EQ оформя тоналния характер на сигнала, като усилва или намалява конкретни честотни области. Всяка лента обхваща своя зона: ниски (тяло), средни (присъствие), високи (въздух и яснота). Режим Bell оформя връх или вдлъбнатина; Shelf усилва или намалява всичко над или под зададена честота.',
        why: 'Всеки звуков източник има честоти, които помагат, и такива, които пречат. Вокалите например може да се нуждаят от по-малко "кутиен" звук около 400 Hz, повече присъствие при 3 kHz и повече въздух при 10 kHz.',
        tip: 'На практика EQ се използва предимно субтрактивно — намалявай нежеланото, вместо да усилваш всичко. В средно ниво можеш да превключваш ниската и високата лента към Shelf режим за по-плавен и музикален резултат.',
      },
      'graphic-eq': {
        what: 'Графичният EQ разделя звуковия спектър на фиксирани честотни ленти (тук: 10 ленти, по една на октава от 31 Hz до 16 kHz). Всяка лента има свой фейдър — дърпай нагоре за усилване, надолу за намаляване.',
        why: 'Графичните EQ се намират на главния изход на озвучителни системи и служат за корекция на акустиката на помещението — внезапен пик при 4 kHz, резонанс при 63 Hz. По-малко прецизни са от параметричните, но по-бързи за широки корекции.',
        tip: 'При живо озвучаване графичният EQ на главния изход се използва предимно срещу обратна връзка и за акустична корекция — не за оформяне на микса. Дръж промените малки: леки намалявания (−3 до −6 dB) решават повечето проблеми. Силните усилвания причиняват обратна връзка и изкривяване.',
      },
      comp: {
        what: 'Компресорът намалява динамичния диапазон на сигнала — автоматично сваля силните пикове и може да работи с компенсиращо усилване, за да вдигне общото ниво. Тихите части стават относително по-силни, а силните — относително по-тихи.',
        why: 'Живите изпълнения и записите имат широк динамичен диапазон. Без компресия силните ноти изкривяват, а тихите се губят в шума. Компресията прави сигнала по-равномерен и контролируем.',
        tip: 'Следи метъра за намаление на усилването. 2–6 dB е прозрачно и музикално. Над 10 dB звукът започва да "помпа" и да се чува смачкан — което понякога е търсен ефект, но рядко е подходящо за начинаещи.',
      },
      fader: {
        what: 'Каналният фейдър управлява нивото на този сигнал, когато влиза в микса. При нулево положение (0 dB) сигналът преминава без промяна. Свалянето на фейдъра го заглушава.',
        why: 'Всеки инструмент в микса трябва да е на правилното ниво спрямо останалите. Фейдърът е основният инструмент за задаване на този баланс.',
        tip: 'В един завършен микс повечето фейдъри стоят под нулевото положение. Изкуството на миксирането е в относителния баланс между всички канали — не в правенето на всеки от тях колкото се може по-силен.',
      },
      amp: {
        what: 'Крайният усилвател взима линеен сигнал и го усилва до ниво за задвижване на тонколони — добавя значителен ток, не само напрежение. Пасивна тонколона (без вграден усилвател) не може да произведе звук без крайния усилвател.',
        why: 'Линейните сигнали са достатъчно силни за смесване и обработка, но не и за физическото движение на мембраната на тонколоната. Крайният усилвател осигурява необходимия ток.',
        tip: 'Крайните усилватели се оценяват в вата. За студийни монитори обикновено са нужни 50–100 W. За живо озвучаване — 500–2000 W на страна. Повече вата означава повече запас преди изкривяване, не непременно по-силен звук.',
      },
      switch: {
        what: 'Превключвателят (или бутонът за заглушаване) е най-простият контрол в сигналната верига. Когато е включен, сигналът минава непроменен. Когато е изключен, сигналът е напълно отрязан — пълна тишина.',
        why: 'Заглушаването се използва, за да се спре каналът между записи, за да се предотврати обратна връзка при неизползван микрофон или за изолиране на запис при миксиране.',
        tip: 'При живо озвучаване навикът да заглушаваш микрофони, когато не се използват, предотвратява просмукване, шум от допир и обратна връзка. Всеки звукорежисьор го научава бързо.',
      },
      potentiometer: {
        what: 'Потенциометърът е променливо съпротивление, използвано като регулатор на ниво. Работи по аудио крива, която отговаря на начина, по който ухото ни възприема силата на звука — по-голямата част от използвания диапазон е в горната половина на въртенето.',
        why: 'Аудио оборудването използва потенциометри за регулатори на сила на звука, нива на изпращане и тримери. Аудио кривата прави управлението да изглежда линейно, въпреки че силата на звука е логаритмична величина.',
        tip: 'Позицията 12 часа (50%) не е нулево усилване при аудио потенциометър — нулата е обикновено при около 75% от въртенето. Тук: пълно ляво = тишина, 75% = 0 dB, пълно дясно = +10 dB.',
      },
      bus: {
        what: 'Бусът (или спомагателният бус) събира сигнали от множество канали и ги обединява в един изход. Използва се за групиране, изпращане към ефекти, монитор миксове и субмиксове.',
        why: 'Групирането на свързани канали (например всички барабанни канали) върху бус ти позволява да управляваш общото им ниво с един фейдър. Изпращанията към ефекти използват бус, за да насочат копие от няколко канала към реверб или дилей.',
        tip: 'Дръж нивата на буса добре под 0 dBu — всеки канал, захранващ буса, се прибавя към общото, така че с много входове изходът може да е значително по-силен от всеки отделен канал.',
      },
      'master-bus': {
        what: 'Мастър бусът е последната точка на сумиране, където всички канали се събират, преди сигналът да напусне системата. Всяко движение на фейдър и всяко решение за обработка в крайна сметка завършва тук.',
        why: 'Мастър бусът управлява общото изходно ниво. Тук се прилага и финалната обработка — фина компресия или ограничаване за контрол на пиковете и за "сплотяване" на звука.',
        tip: 'Оставяй запас на мастър буса — пиковете в идеалния случай трябва да са под -6 dBu. Мастър бус, който вече е на 0 dBu, няма накъде да отиде.',
      },
      master: {
        what: 'Мастър бусът получава всички канали смесени заедно. Той е последният етап, преди сигналът да напусне системата. Малко изравняване тук регулира общото изходно ниво.',
        why: 'Мастър бусът е мястото, където се контролира финалното ниво на микса. Тук се прилага и всяка финална обработка — в професионалните студия фина компресия и ограничаване "сплотяват" микса.',
        tip: 'Оставяй запас на мастър буса — пиковете не трябва да надвишават -6 dBu. Това оставя място за мастеринг инженер (или ограничител) да свърши работата си без изкривяване.',
      },
      speaker: {
        what: 'Пасивната тонколона превръща електрическия сигнал обратно в звук, но няма вграден усилвател. Нуждае се от отделен крайен усилвател (Amp възел) — директното включване към линейно ниво не произвежда звук.',
        why: 'Пасивните тонколони са стандарт при живо озвучаване и hi-fi инсталации. Усилвателят е отделен блок, избиран според необходимата мощност и импеданса на тонколоната.',
        tip: 'Свържи Amp възел преди тази тонколона. Усилвателят осигурява тока, необходим за физическото движение на мембраната. Без него сигналът съществува, но нищо не се движи.',
      },
      'active-speaker': {
        what: 'Активната (захранена) тонколона има вграден усилвател. Приема линейни сигнали директно от миксер, аудио интерфейс или всеки друг линеен изход — без нужда от отделен усилвател.',
        why: 'Активните тонколони са стандарт в съвременните студийни монитори и преносими PA системи. Вграденият усилвател е съобразен с говорителя, затова захранените монитори обикновено звучат по-точно и последователно.',
        tip: 'Регулаторът за сила на звука задава финалното изходно ниво. Добрата стъпалост означава зелен сигнал до тази тонколона — след това използвай регулатора, за да зададеш колко силно искаш да слушаш, а не за да компенсираш лошо настроена верига.',
      },
    },
  },
}

export function fmt(str: string, params: Record<string, string>): string {
  return str.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`)
}
