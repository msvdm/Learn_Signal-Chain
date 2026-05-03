export type Lang = string

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
    // domain / ADC / DAC warnings
    domainMixedBus?: string
    digitalToAmp?: string
    digitalToSpeaker?: string
    adcExpectsAnalog?: string
    dacExpectsDigital?: string
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
    // New nodes — optional so older locale files remain valid during translation
    'di-box'?: { label?: string; groundLift?: string; xlrOut?: string; directOut?: string; description?: string }
    'noise-gate'?: { label?: string; threshold?: string; statusOpen?: string; statusClosed?: string }
    limiter?: { label?: string; ceiling?: string; limiting?: string }
    deesser?: { label?: string; threshold?: string; frequency?: string; gainReduction?: string }
    relay?: { label?: string }
    pan?: { label?: string }
    'audio-interface'?: { label?: string; noChannels?: string; digitalIn?: string; analogIn?: string }
    adc?: { label?: string }
    dac?: { label?: string }
    'mono-bus'?: { label?: string; channels?: string; noChannels?: string }
    'stereo-bus'?: { label?: string }
    'stereo-fader'?: { label?: string; fader?: string }
    balance?: { label?: string; leftLabel?: string; rightLabel?: string; centerLabel?: string }
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
    categories: { source: string; processing: string; structural?: string; routing: string; output: string }
    items: Record<string, string>
  }
  theory: Record<string, TheoryEntry>
}

export function fmt(str: string, params: Record<string, string>): string {
  return str.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`)
}
