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
  const t=typographyFor(textSizeCode),line=(size,multiplier)=>Math.round(size*multiplier);
  const terminal={fontFamily:theme.font.terminal};
  const body={fontFamily:theme.font.body};
  const display={fontFamily:theme.font.display};
  return {
    display:{fontSize:t.display,lineHeight:line(t.display,1.04),fontWeight:'800',...display},
    title:{fontSize:t.title,lineHeight:line(t.title,1.18),fontWeight:'800',...display},
    heading:{fontSize:t.emphasis,lineHeight:line(t.emphasis,1.25),fontWeight:'800',...body},
    body:{fontSize:t.body,lineHeight:line(t.body,1.45),...body},
    emphasis:{fontSize:t.emphasis,lineHeight:line(t.emphasis,1.3),fontWeight:'700',...body},
    caption:{fontSize:t.caption,lineHeight:line(t.caption,1.35),...body},
    helper:{fontSize:t.caption,lineHeight:line(t.caption,1.35),fontWeight:'600',...terminal},
    micro:{fontSize:t.micro,lineHeight:line(t.micro,1.2),...terminal},
    terminal:{fontSize:t.caption,lineHeight:line(t.caption,1.25),fontWeight:'700',...terminal},
    result:{fontSize:t.result,lineHeight:line(t.result,1.02),fontWeight:'800',...display},
    button:{fontSize:t.body,lineHeight:line(t.body,1.2),fontWeight:'800',...body},
    navigation:{fontSize:t.micro,lineHeight:line(t.micro,1.15),fontWeight:'750',...terminal},
    wordCard:{fontSize:t.display,lineHeight:line(t.display,1.03),fontWeight:'800',...display},
    question:{fontSize:t.display,lineHeight:line(t.display,1.04),fontWeight:'800',...display},
  };
}

export function colorToken(name,fallback) {
  const mapped=W.surfaces[name]||W.borders[name]||name;
  return W.colors[mapped]||fallback||mapped;
}