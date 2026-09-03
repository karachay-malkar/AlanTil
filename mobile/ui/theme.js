import { WEB_VISUAL_TOKENS } from './web-visual-source.js';

const W=WEB_VISUAL_TOKENS;

export const theme={
  colors:W.colors,
  surfaces:W.surfaces,
  borders:W.borders,
  font:W.font,
  typeScale:W.typeScale,
  type:W.typeScale.medium,
  radius:W.radius,
  spacing:W.spacing,
  control:W.control,
  path:W.path,
  chrome:W.chrome,
  safeArea:W.safeArea,
  breakpoints:W.breakpoints,
  motion:W.motion,
  layout:W.layout,
  shadow:W.shadow,
  states:W.states,
  button:W.button,
  input:W.input,
  panel:W.panel,
  modal:W.modal,
  segmented:W.segmented,
  progress:W.progress,
  list:W.list,
  favorite:W.favorite,
  account:W.account,
};

export function typographyFor(textSizeCode='medium') {
  return W.typeScale[textSizeCode]||W.typeScale.medium;
}

export function semanticTypography(textSizeCode='medium') {
  const t=typographyFor(textSizeCode);
  return {
    micro:{fontSize:t.micro,lineHeight:Math.round(t.micro*1.2),fontFamily:theme.font.terminal},
    caption:{fontSize:t.caption,lineHeight:Math.round(t.caption*1.35),fontFamily:theme.font.body},
    body:{fontSize:t.body,lineHeight:Math.round(t.body*1.45),fontFamily:theme.font.body},
    emphasis:{fontSize:t.emphasis,lineHeight:Math.round(t.emphasis*1.3),fontWeight:'700',fontFamily:theme.font.body},
    title:{fontSize:t.title,lineHeight:Math.round(t.title*1.18),fontWeight:'800',fontFamily:theme.font.display},
    display:{fontSize:t.display,lineHeight:Math.round(t.display*1.04),fontWeight:'800',fontFamily:theme.font.display},
    result:{fontSize:t.result,lineHeight:Math.round(t.result*1.02),fontWeight:'800',fontFamily:theme.font.display},
  };
}

export function colorToken(name,fallback) {
  const mapped=W.surfaces[name]||W.borders[name]||name;
  return W.colors[mapped]||fallback||mapped;
}
