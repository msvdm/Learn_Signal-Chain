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
    settings: string
    reset: string
    language: string
    level: string
    theme: { toggle: string; light: string; dark: string }
  }
  dialog: {
    cancel: string
    resetTitle: string
    resetConfirm: string
    resetBody: string
    switchTitle: string
    switchConfirm: string
    switchBody: string
  }
  toolbar: {
    snap: string
    snapHint: string
    zoom: string
    zoomIn: string
    zoomOut: string
    zoomFit: string
  }
  connecting: { from: string; hint: string; cancel: string; input: string }
  levels: {
    beginner:     { title: string; description: string }
    intermediate: { title: string; description: string }
    advanced:     { title: string; description: string }
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
    nextNode: string
    previous: string
    stepOf: string
    close: string
    help: string
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
      bandLoMid?: string
      gain?: string
      freq?: string
      widthQ?: string
      /** Tooltip of Width (Q) on a shelf band, where it does nothing */
      widthShelf?: string
      shelf?: string
      shelfHint?: string
      graphHint?: string
      /** Extra graph hint when the band width can be changed (Advanced) */
      graphHintWidth?: string
    }
    graphicEq: { label: string }
    comp: {
      label: string
      threshold: string
      ratio: string
      makeupGain: string
      gainReduction: string
      turningDown: string
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
    limiter?: { label?: string; ceiling?: string; makeupGain?: string; limiting?: string }
    pad?: { label?: string; on?: string; off?: string }
    deesser?: { label?: string; threshold?: string; frequency?: string; gainReduction?: string }
    relay?: { label?: string }
    pan?: { label?: string; balanceLabel?: string }
    'audio-interface'?: { label?: string; noChannels?: string; digitalIn?: string; analogIn?: string }
    adc?: { label?: string }
    dac?: { label?: string }
    'aux-bus'?: { label?: string; channels?: string; noChannels?: string }
    /** A Fader wired straight after a stereo bus */
    'main-fader': { label: string }
    /** {n} = input / output number */
    matrix: { label: string; input: string; output: string; empty: string }
    balance?: { label?: string; leftLabel?: string; rightLabel?: string; centerLabel?: string }
  }
  eqCurve: { title: string; subtitle: string; band: string }
  nodeControls: {
    /** Tooltip of the On/Off button while the node is on */
    turnOff: string
    /** Tooltip of the On/Off button while the node is bypassed */
    turnOn: string
    remove: string
    bypassedShort: string
    /** Tooltip of a connected input port (it unplugs the wire on click) */
    unplug: string
  }
  stereo: {
    mono: string
    stereo: string
    /** Tooltip of the Mono | Stereo switch */
    toggleHint: string
  }
  unplugMenu: {
    title: string
    via: string
    unplugOne: string
    unplugAll: string
    hint: string
  }
  palette: {
    elements: string
    search: string
    all: string
    startHere: string
    noResults: string
    categories: { source: string; processing: string; routing: string; output: string }
    items: Record<string, string>
  }
  theory: Record<string, TheoryEntry>
}

export function fmt(str: string, params: Record<string, string>): string {
  return str.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`)
}
