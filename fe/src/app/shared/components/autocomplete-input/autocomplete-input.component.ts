import { Component, Input, forwardRef, signal, computed } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-autocomplete-input',
  standalone: true,
  imports: [CommonModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => AutocompleteInputComponent),
    multi: true,
  }],
  templateUrl: './autocomplete-input.component.html',
  styleUrl: './autocomplete-input.component.scss',
})
export class AutocompleteInputComponent implements ControlValueAccessor {
  @Input() suggestions: string[] = [];
  @Input() placeholder = '';

  value = signal('');
  isOpen = signal(false);
  isDisabled = false;

  filtered = computed(() => {
    const q = this.value().toLowerCase().trim();
    if (!q) return this.suggestions;
    return this.suggestions.filter((s) => s.toLowerCase().includes(q));
  });

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(val: string): void        { this.value.set(val ?? ''); }
  registerOnChange(fn: any): void      { this.onChange = fn; }
  registerOnTouched(fn: any): void     { this.onTouched = fn; }
  setDisabledState(d: boolean): void   { this.isDisabled = d; }

  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.value.set(val);
    this.onChange(val);
    this.isOpen.set(true);
  }

  onFocus(): void { this.isOpen.set(true); }

  onBlur(): void {
    this.onTouched();
    setTimeout(() => this.isOpen.set(false), 120);
  }

  select(opt: string, event: MouseEvent): void {
    event.preventDefault();
    this.value.set(opt);
    this.onChange(opt);
    this.isOpen.set(false);
  }

  clear(event: MouseEvent): void {
    event.preventDefault();
    this.value.set('');
    this.onChange('');
    this.onTouched();
    this.isOpen.set(false);
  }
}
