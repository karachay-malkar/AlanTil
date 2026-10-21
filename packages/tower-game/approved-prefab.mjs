/** Read-only author-approved masonry variant mapping; historic prefab versions remain loadable. */
export const APPROVED_PREFAB_VERSION='17.7-approved-manual.1';
export const APPROVED_LIBRARY_ROOT='/assets/tower/approved-library';
export const APPROVED_CATALOG_URL=APPROVED_LIBRARY_ROOT+'/index.json?v=17.7-approved-masonry.1';
export const APPROVED_MASONRY_VARIANTS=Object.freeze({
 '1x1x1':Object.freeze(['manual-1x1x1-v1','manual-1x1x1-v2','manual-1x1x1-v3']),
 '2x2x2':Object.freeze(['manual-2x2x2-v1','manual-2x2x2-v2','manual-2x2x2-v3']),
 '2x3x4':Object.freeze(['manual-2x3x4-v1','manual-2x3x4-v2','manual-2x3x4-v3']),
 '3x3x3':Object.freeze(['manual-3x3x3-v1','manual-3x3x3-v2'])
});
export const APPROVED_MASONRY_TYPES=Object.freeze(Object.keys(APPROVED_MASONRY_VARIANTS));
export const isApprovedMasonryType=id=>Object.hasOwn(APPROVED_MASONRY_VARIANTS,id);
export const approvedVariantCount=id=>APPROVED_MASONRY_VARIANTS[id]?.length||0;
export function approvedSectionId(type,variant){
 const id=APPROVED_MASONRY_VARIANTS[type]?.[variant];
 if(!id||!Number.isInteger(variant))throw new TypeError('Unknown approved manual stone section');
 return id;
}
