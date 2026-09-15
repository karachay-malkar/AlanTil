export const SHOT_ICON_VIEWBOX='0 0 24 24';

export const SHOT_ICON_PATHS=Object.freeze({
  tap:Object.freeze({
    paths:Object.freeze(['M12 4.5v3','M12 16.5v3','M4.5 12h3','M16.5 12h3']),
    circles:Object.freeze([{cx:12,cy:12,r:2.6},{cx:12,cy:12,r:5.1}]),
  }),
  flat:Object.freeze({
    paths:Object.freeze(['M3.5 12h15','M14.5 8.5 18.5 12l-4 3.5']),
    dashed:Object.freeze([0]),
  }),
  hop:Object.freeze({
    paths:Object.freeze(['M3.5 16.5C7 6.5 14.2 6.2 19 13.2','M15.2 12.2 19 13.2l-1.5 3.6']),
    dashed:Object.freeze([0]),
  }),
});
