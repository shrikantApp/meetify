/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import styles from './InputField.module.css';
import 'react-datepicker/dist/react-datepicker.css';

type InputLikeType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'search'
  | 'tel'
  | 'url'
  | 'date'
  | 'time'
  | 'datetime-local'
  | 'month'
  | 'week'
  | 'color'
  | 'file';

type BaseProps = {
  label?: string;
  optionalLabel?: string;
  hint?: string;
  error?: string;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  wrapperClassName?: string;
  labelClassName?: string;
  controlClassName?: string;
};

type InputProps = BaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
    as?: 'input';
    type?: InputLikeType;
  };

type TextareaProps = BaseProps &
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    as: 'textarea';
  };

type SelectOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type SelectProps = BaseProps &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
    as: 'select';
    options: SelectOption[];
    placeholderOption?: string;
  };

type CustomProps = BaseProps & {
  as: 'custom';
  children: React.ReactNode;
};

type ReactSelectOption = { label: string; value: string };

type ReactSelectProps = BaseProps & {
  as: 'reactSelect';
  value: ReactSelectOption | null;
  onChange: (option: ReactSelectOption | null) => void;
  options: ReadonlyArray<ReactSelectOption>;
  placeholder?: string;
  isClearable?: boolean;
  isDisabled?: boolean;
};

type DatePickerProps = BaseProps & {
  as: 'datePicker';
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  isDisabled?: boolean;
};

export type InputFieldProps = InputProps | TextareaProps | SelectProps | CustomProps | ReactSelectProps | DatePickerProps;

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export const InputField = forwardRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, InputFieldProps>(
  (props, ref) => {
    const {
      label,
      optionalLabel,
      hint,
      error,
      startAdornment,
      endAdornment,
      wrapperClassName,
      labelClassName,
      controlClassName,
    } = props;

    const sharedControlClassName = cx(
      styles.control,
      !!startAdornment && styles.hasStart,
      !!endAdornment && styles.hasEnd,
      !!error && styles.controlError,
      controlClassName,
    );

    const renderControl = () => {
      if (props.as === 'custom') {
        const { children } = props;
        return <div className={cx(styles.customControl, controlClassName)}>{children}</div>;
      }

      if (props.as === 'reactSelect') {
        const { value, onChange, options, placeholder, isClearable = true, isDisabled } = props;
        return (
          <div className={cx(styles.customControl, controlClassName)}>
            <Select
              classNamePrefix="meetify-select"
              value={value}
              onChange={(opt) => onChange((opt as ReactSelectOption) ?? null)}
              options={[...options]}
              isClearable={isClearable}
              isDisabled={isDisabled}
              placeholder={placeholder}
              menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
              menuPosition="fixed"
              styles={getReactSelectStyles(!!error)}
            />
          </div>
        );
      }

      if (props.as === 'datePicker') {
        const { value, onChange, placeholder, isDisabled } = props;
        return (
          <div className={cx(styles.customControl, controlClassName)}>
            <DatePicker
              selected={value}
              onChange={(date: Date | null) => onChange(date)}
              dateFormat="yyyy-MM-dd"
              placeholderText={placeholder ?? 'YYYY-MM-DD'}
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              disabled={isDisabled}
              className={cx('meetify-datepicker', !!error && 'meetify-datepicker-error')}
              popperClassName="meetify-datepicker-popper"
            />
          </div>
        );
      }

      if (props.as === 'textarea') {
        const { as, ...textareaProps } = props;
        return (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            {...textareaProps}
            className={cx(sharedControlClassName, styles.textarea)}
          />
        );
      }

      if (props.as === 'select') {
        const { as, options, placeholderOption, ...selectProps } = props;
        return (
          <>
            <select
              ref={ref as React.Ref<HTMLSelectElement>}
              {...selectProps}
              className={cx(sharedControlClassName, styles.select)}
            >
              {placeholderOption ? (
                <option value="" disabled>
                  {placeholderOption}
                </option>
              ) : null}
              {options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className={cx(styles.selectIcon)} size={16} />
          </>
        );
      }

      const { as, type = 'text', ...inputProps } = props;
      return (
        <input
          ref={ref as React.Ref<HTMLInputElement>}
          {...inputProps}
          type={type}
          className={sharedControlClassName}
        />
      );
    };

    return (
      <div className={cx(styles.field, wrapperClassName)}>
        {label ? (
          <div className={styles.labelRow}>
            <label className={cx(styles.label, labelClassName)}>{label}</label>
            {optionalLabel ? <span className={styles.optional}>{optionalLabel}</span> : null}
          </div>
        ) : null}

        <div className={styles.controlWrap}>
          {startAdornment ? <span className={styles.iconStart}>{startAdornment}</span> : null}
          {renderControl()}
          {endAdornment && props.as !== 'select' && props.as !== 'custom' ? (
            <span className={styles.iconEnd}>{endAdornment}</span>
          ) : null}
        </div>

        {error ? (
          <p className={cx(styles.helper, styles.error)}>{error}</p>
        ) : hint ? (
          <p className={styles.helper}>{hint}</p>
        ) : null}
      </div>
    );
  },
);

InputField.displayName = 'InputField';

function getReactSelectStyles(hasError: boolean) {
  const baseBorder = hasError ? 'rgba(225, 29, 72, 0.45)' : 'var(--border-subtle)';
  const focusBorder = hasError ? 'rgba(225, 29, 72, 0.45)' : 'var(--accent-primary)';
  const focusShadow = hasError ? '0 0 0 4px rgba(225, 29, 72, 0.12)' : '0 0 0 4px rgba(17, 100, 163, 0.14)';

  return {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: 'unset',
      borderRadius: '0.85rem',
      borderColor: state.isFocused ? focusBorder : baseBorder,
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      boxShadow: state.isFocused ? focusShadow : 'none',
      transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease',
      fontSize: '0.92rem',
      fontFamily: 'inherit',
    }),
    valueContainer: (base: any) => ({
      ...base,
      padding: '0.8rem 0.95rem',
      gap: '0.35rem',
    }),
    indicatorsContainer: (base: any) => ({
      ...base,
      paddingRight: '0.35rem',
      alignSelf: 'stretch',
    }),
    input: (base: any) => ({
      ...base,
      margin: 0,
      padding: 0,
      color: 'var(--text-primary)',
    }),
    singleValue: (base: any) => ({ ...base, color: 'var(--text-primary)' }),
    placeholder: (base: any) => ({ ...base, color: 'var(--text-muted)' }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: 'rgba(16, 18, 23, 0.98)',
      border: '1px solid var(--border-subtle)',
      overflow: 'hidden',
      borderRadius: '1rem',
    }),
    menuPortal: (base: any) => ({
      ...base,
      zIndex: 500,
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isFocused ? 'var(--surface-soft-hover)' : 'transparent',
      color: 'var(--text-primary)',
      cursor: 'pointer',
    }),
    indicatorSeparator: (base: any) => ({ ...base, backgroundColor: 'var(--border-subtle)' }),
    dropdownIndicator: (base: any) => ({ ...base, color: 'var(--text-muted)' }),
    clearIndicator: (base: any) => ({ ...base, color: 'var(--text-muted)' }),
  };
}
