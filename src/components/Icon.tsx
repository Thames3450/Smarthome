import type { CSSProperties } from 'react';
import {iconUrl} from '../lib/icons';
export function Icon({name,size=24,className='',style}:{name:string,size?:number,className?:string,style?:CSSProperties}){
 return <img className={`ui-icon ${className}`} src={iconUrl(name)} width={size} height={size} alt="" aria-hidden="true" loading="lazy" style={style}/>;
}
