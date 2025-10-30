import React, { FC } from 'react'
import Loading from '../Loading/Loading';

type ButtonProps = {
  text?: string,
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  loading?: boolean;
  active?: boolean;
} & React.ButtonHTMLAttributes<Element>

const Button: FC<ButtonProps> = ({
  className = '',
  text,
  children,
  loading,
  active,
  startIcon,
  endIcon,
  ...rest
}) => {
  return (
    <button
      disabled={loading}
      className={`rounded border ${className} ${active ? "border-[#E4462D]" : "border-white/10"} px-6 py-2 space-x-2 flex items-center ${rest.onClick ? "hover:gradient-background" : "cursor-default"} mx-auto`}
      {...rest}
    >
      {startIcon}
      <div className='flex-1 text-ghost-white'>
        {loading ?
          <Loading width={28} height={28} />
          :
          (text ?
            <span className='text-[18px] font-medium text-ghost-white'>{text}</span>
            : children)
        }
      </div>
      {endIcon}
    </button>
  )
}

export default Button