/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './InputField.module.css';

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

export type InputFieldProps = InputProps | TextareaProps | SelectProps;

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
          {endAdornment && props.as !== 'select' ? <span className={styles.iconEnd}>{endAdornment}</span> : null}
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
