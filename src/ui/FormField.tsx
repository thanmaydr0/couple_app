import { type TextInputProps } from 'react-native';
import { TextField } from './TextField';
/** @deprecated Use TextField. Existing label and TextInput props are preserved. */
export function FormField(props: TextInputProps & { label: string }) { return <TextField {...props} />; }
