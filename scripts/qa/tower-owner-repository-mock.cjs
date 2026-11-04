/** Owner-only isolated repository for WebGL QA. Never changes production Auth/RLS. */
const OWNER='dfcf124e-735b-4caa-81d2-99eb5f02218d';
module.exports=async function mockTowerOwnerRepository(page){
 await page.route('**/src/features/tower/repository.js*',route=>route.fulfill({
  status:200,contentType:'text/javascript',
  body:`
   export const towerUserId=()=> 'dfcf124e-735b-4caa-81d2-99eb5f02218d';
   export const loadTowerV3=async()=>({format:3,revision:0,elements:[],resetAt:null,tekmetBalance:1000});
   export const loadTowerRoofs=async()=>({roofs:[],balance:1000});
   export const mutateTowerV3=async()=>{throw Error('QA_READ_ONLY')};
   export const placeTowerLine=async()=>{throw Error('QA_READ_ONLY')};
   export const removeTowerV3Sections=async()=>{throw Error('QA_READ_ONLY')};
   export const clearTowerV3=async()=>{throw Error('QA_READ_ONLY')};
   export const placeTowerRoof=async()=>{throw Error('QA_READ_ONLY')};
   export const removeTowerRoof=async()=>{throw Error('QA_READ_ONLY')};
  `
 }));
};
