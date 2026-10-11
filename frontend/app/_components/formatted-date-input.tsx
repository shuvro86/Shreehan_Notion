import type {ChangeEvent} from 'react';
import {formatDate} from '../_lib/date-format';

export default function FormattedDateInput({label,value,onChange,required=false}:{label:string;value:string;onChange:(event:ChangeEvent<HTMLInputElement>)=>void;required?:boolean}) {
 return <span className="formatted-date-input"><span aria-hidden="true">{value?formatDate(value):'Select date'}</span><input type="date" aria-label={label} required={required} value={value} onChange={onChange}/></span>;
}
