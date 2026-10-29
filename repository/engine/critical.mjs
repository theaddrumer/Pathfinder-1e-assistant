/** Per-attack GM/controller eligibility for precision dice; not inferred from target position. */
import {RiderGame} from './riders.mjs';
export class CriticalGame extends RiderGame {
 dispatch(command,role='actor'){
  if(['attack','full_attack','full_attack_next','admin_attack'].includes(command?.op)){
   if(command.precisionEligible!==undefined)this.assert(typeof command.precisionEligible==='boolean','Invalid precision eligibility flag');
   const previous=this._precisionEligible;
   this._precisionEligible=command.precisionEligible;
   try{return super.dispatch(command,role);}finally{this._precisionEligible=previous;}
  }
  return super.dispatch(command,role);
 }
}
