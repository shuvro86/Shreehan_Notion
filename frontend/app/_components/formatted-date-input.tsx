import {useRef,type ChangeEvent} from 'react';
import {CalendarDays} from 'lucide-react';
import {formatDate} from '../_lib/date-format';

export default function FormattedDateInput({label,value,onChange,required=false}:{label:string;value:string;onChange:(event:ChangeEvent<HTMLInputElement>)=>void;required?:boolean}) {
 const inputRef=useRef<HTMLInputElement>(null);
 function openCalendar(){
  const input=inputRef.current;
  if(!input)return;
  if(typeof input.showPicker==='function')input.showPicker();
  else input.focus();
 }
 return <span className="formatted-date-input"><span aria-hidden="true">{value?formatDate(value):'Select date'}</span><input ref={inputRef} type="date" aria-label={label} required={required} value={value} onChange={onChange}/><button type="button" aria-label="Open date picker" onClick={openCalendar}><CalendarDays size={17}/></button></span>;
}
