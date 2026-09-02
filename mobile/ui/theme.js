import { WEB_VISUAL_TOKENS } from './web-visual-source.js';

const W=WEB_VISUAL_TOKENS;

export const theme={
  colors:W.colors,
  font:{body:undefined,display:undefined,brand:'serif',terminal:'monospace'},
  typeScale:W.typeScale,
  type:W.typeScale.medium,
  radius:W.radius,
  spacing:W.spacing,
  control:W.control,
  chrome:W.chrome,
  motion:W.motion,
  layout:W.layout,
  shadow:W.shadow,
};

export function typographyFor(textSizeCode='medium') {
  return W.typeScale[textSizeCode]||W.typeScale.medium;
}

export function semanticTypography(textSizeCode='medium') {
  const t=typographyFor(textSizeCode);
  return {
    micro:{fontSize:t.micro,lineHeight:Math.round(t.micro*1.2),fontFamily:theme.font.terminal},
    caption:{fontSize:t.caption,lineHeight:Math.round(t.caption*1.35)},
    body:{fontSize:t.body,lineHeight:Math.round(t.body*1.45)},
    emphasis:{fontSize:t.emphasis,lineHeight:Math.round(t.emphasis*1.3),fontWeight:'700'},
    title:{fontSize:t.title,lineHeight:Math.round(t.title*1.18),fontWeight:'800'},
    display:{fontSize:t.display,lineHeight:Math.round(t.display*1.04),fontWeight:'800'},
    result:{fontSize:t.result,lineHeight:Math.round(t.result*1.02),fontWeight:'800'},
  };
}
