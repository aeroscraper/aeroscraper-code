import { INotification } from '@/contexts/NotificationProvider';
import { motion } from 'framer-motion';
import React, { PropsWithChildren } from 'react'
import Loading from '../Loading/Loading';
import Tooltip, { PLACEMENT_CLASSES } from '../Tooltip/Tooltip';
import Text from '@/components/Texts/Text';
import { isNil } from 'lodash';

const bgColor = {
  'success': 'success-gradient',
  'error': 'error-gradient',
  'default': 'main-gradient',
  "networkchange": 'success-gradient'
}

type Props = {
  loading?: boolean;
  text?: string;
  status?: INotification;
  disabledText?: string;
  tooltipPlacement?: keyof typeof PLACEMENT_CLASSES;
} & React.ButtonHTMLAttributes<Element>

const Transaction: React.FC<PropsWithChildren<Props>> = ({
  className = '',
  loading = false,
  status,
  text = '',
  onClick = undefined,
  disabledText,
  tooltipPlacement,
  ...rest
}
) => {


  const returnText = status?.status ?? text;

  const returnColor = status?.status ?? 'default';

  const capitalizeFirstLetter = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  const openTransactionDetail = () => {
    window.open(`https://sei.explorers.guru/transaction/${status?.directLink}`, '_blank');
  }

  return (
    <Tooltip placement={tooltipPlacement} active={!!rest.disabled && !isNil(disabledText)} title={<Text size='base'>{disabledText}</Text>} >
      <button
        disabled={loading}
        onClick={status?.directLink ? openTransactionDetail : onClick}
        className={`py-5 ${className} ${bgColor[returnColor]} flex justify-center gap-2 items-center rounded-lg active:scale-95 transition-all disabled:opacity-60 disabled:active:scale-100 duration-150 disabled:cursor-not-allowed`}
        {...rest}
      >
        <motion.div className='text-ghost-white'>
          {loading ?
            <Loading width={28} height={28} />
            : capitalizeFirstLetter(returnText)
          }
        </motion.div>
        {status?.directLink && <motion.img
          initial={{ marginLeft: -16 }}
          animate={{ marginLeft: 0 }}
          transition={{ stiffness: 50 }}
          layout alt='external-link' src='/images/external-link.svg' className='w-4 h-4 ml-1' />}
      </button>
    </Tooltip>

  )
}

export default Transaction