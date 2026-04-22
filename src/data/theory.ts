export interface TheoryEntry {
  what: string
  why: string
  tip: string
}

export const theory: Record<string, TheoryEntry> = {
  mic: {
    what: 'The microphone converts sound (acoustic energy) into an electrical signal. It outputs a very weak voltage — typically around -60 dBu for a dynamic microphone.',
    why: 'Everything starts here. The quality and placement of the microphone determines the raw material for the entire signal chain. A good source signal makes everything downstream easier.',
    tip: 'The signal is in the blue (too quiet) zone — that is completely normal and expected at this stage. The preamp\'s job is to fix that.',
  },
  preamp: {
    what: 'The preamplifier (preamp) boosts the weak microphone-level signal up to "line level" — strong enough for the rest of the chain to work with. Typical gain: +20 to +60 dB.',
    why: 'Without enough gain here, all downstream processors — EQ, compressor, fader — work with a weak signal and introduce more noise. Too much gain causes distortion before anything else can help.',
    tip: 'Aim for the output to land in the green zone (-40 to -12 dBu). This is called gain staging, and it starts right here at the preamp.',
  },
  eq: {
    what: 'The equalizer (EQ) shapes the tonal character of the signal by boosting or cutting specific frequency ranges. It does not change the overall level much — it shapes the sound.',
    why: 'Every sound source has frequencies that help or hurt its purpose. A vocal may have too much low rumble (fix with a high-pass filter) or need more air in the highs (boost a shelf at 10 kHz).',
    tip: 'EQ is mostly subtractive in professional practice — cut what you don\'t need rather than boosting everything. Boosting adds energy; cutting cleans up the mix.',
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
  master: {
    what: 'The master bus receives all channel signals mixed together. It is the final stage before the signal leaves the system. A small trim here adjusts the overall output level.',
    why: 'The master bus is where your final mix level is controlled. It also applies any final processing — in professional studios, subtle compression and limiting are applied here to glue the mix.',
    tip: 'Leave some headroom on the master bus — ideally peaks should not exceed -6 dBu. This leaves room for a mastering engineer (or limiter) to do their job without distortion.',
  },
  speaker: {
    what: 'The speaker (or monitor) converts the electrical signal back into sound waves — the reverse of the microphone. What you hear is the result of every decision made in the signal chain.',
    why: 'The speaker is the final judge. A healthy green signal here means good gain staging throughout. A red signal means distortion. A blue signal means the signal is too quiet and noise will be audible.',
    tip: 'Professional studio monitors are designed to reveal problems in the mix, not flatter it. If it sounds good on accurate monitors, it will translate well to any playback system.',
  },
}
