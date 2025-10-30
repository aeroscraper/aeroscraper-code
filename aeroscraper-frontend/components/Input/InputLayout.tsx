import React, { FC, ReactElement } from 'react'
import BorderedNumberInput, { BG_VARIANTS } from './BorderedNumberInput'
import Text, { TextSizes } from "@/components/Texts/Text";
import { OnValueChange } from 'react-number-format'
import OutlinedButton from '../Buttons/OutlinedButton';

interface Props {
  label?: string,
  labelSize?: TextSizes,
  hintTitle?: string,
  hasPercentButton?: { max: boolean, min: boolean, custom?: boolean }
  customButtonText?: string
  minButtonClick?: () => void,
  maxButtonClick?: () => void,
  customButtonOnClick?: () => void,
  onValueChange?: OnValueChange
  value: string | number,
  totalAmount?: number,
  className?: string,
  rightBottomSide?: ReactElement,
  bgVariant?: keyof typeof BG_VARIANTS;
  inputClassName?: string;
  disabled?: boolean;
}

const InputLayout: FC<Props> = ({ label, labelSize = 'lg', inputClassName, bgVariant, customButtonText, minButtonClick, maxButtonClick, customButtonOnClick, totalAmount, hintTitle, value, onValueChange, className, hasPercentButton, rightBottomSide, disabled }) => {
  return (
    <div className={`bg-dark-purple rounded-lg px-2 py-4 ${className}`}>
      <div className=' flex items-center'>
        <Text size={labelSize} textColor="text-white" weight="font-normal">{label}</Text>
        <BorderedNumberInput disabled={disabled} value={value} onValueChange={onValueChange} className={inputClassName} bgVariant={bgVariant} hintContent={hintTitle} containerClassName="w-1/2 ml-auto" />
        <div className="px-2">
          {hasPercentButton?.min && (
            <OutlinedButton containerClassName="h-7 min-w-16" rounded="lg" onClick={minButtonClick}>
              <Text size='sm'>MIN</Text>
            </OutlinedButton>
          )}
          {hasPercentButton?.max && (
            <OutlinedButton onClick={maxButtonClick} containerClassName="h-7 w-16" rounded="lg">
              <Text size='sm'>MAX</Text>
            </OutlinedButton>
          )}
          {hasPercentButton?.custom && (
            <OutlinedButton onClick={customButtonOnClick} innerClassName="px-2" rounded="lg">
              <Text size='sm'>{customButtonText}</Text>
            </OutlinedButton>
          )}
        </div>
      </div>
      {rightBottomSide}
    </div>
  )
}

export default InputLayout