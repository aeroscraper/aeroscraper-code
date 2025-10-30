import React, { FC } from 'react'
import Text from '@/components/Texts/Text';
import { camelCaseToTitleCase } from '@/utils/stringUtils';
import { motion } from 'framer-motion';

interface Reward {
  type: string;
  value: number;
}

interface Condition {
  type: string;
  value: string;
  operator: string;
}

interface DescriptionContent {
  type: string;
  attrs?: {
    level: number;
    indent: number;
  };
  content: {
    text: string;
    type: string;
  }[];
}

interface Description {
  type: string;
  content: any;
}

export interface ZealyMission {
  name: string;
  content: any[];
  recurrence: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  reward: Reward[];
  position: number;
  published: boolean;
  communityId: string;
  submissionType: string;
  condition: Condition[];
  validationData: {
    enabled: boolean;
  };
  autoValidate: boolean;
  id: string;
  categoryId: string;
  conditionOperator: string;
  claimCounter: number;
  retryAfter: number;
  description: Description;
  tasks: any[];
  v2: boolean;
  claimLimit: number;
  archived: boolean;
  currentXP?: number;
  status: "success" | ""
}

const MissionCard: FC<{ mission: ZealyMission }> = ({ mission }) => {
  return (
    <div className={`
    "w-full border ${mission.reward[0].value == (mission.currentXP ?? 0) ? "border-green-500/50 bg-green-800/10" : "border-white/10 bg-cetacean-dark-blue"} rounded-2xl px-4 pt-4 pb-4 items-end justify-between mt-6"
    `}>
      <div className='w-full flex justify-between gap-6 items-center'>
        <Text size="base" weight="font-bold">{mission.name}</Text>
        <div
          className={`px-8 py-2 m-1 text-base font-medium text-white relative cursor-pointer rounded-md hover:text-red-500 duration-700 whitespace-nowrap text-center`}
        >
          <p>{camelCaseToTitleCase(mission.recurrence)}</p>
          <div className="absolute bottom-0 h-[40px] border-2 rounded-md border-red-500 left-0 right-0" />
        </div>
      </div>
      <div className='mt-2'>
        <Text size="base" weight="font-regular" textColor='text-gray-400' className='line-clamp-2'>{mission.description.content.find((i: any) => i.type === "paragraph").content.find((item: any) => item.type === "text").text}</Text>
      </div>
      <div className='flex mt-4'>
        <div>
          <Text size="sm" weight="font-regular" textColor='text-gray-400' className='mb-1'>Points</Text>
          <Text size="xl" textColor='text-gradient' weight='font-semibold'>
            {mission.reward[0].value}
            &nbsp;{mission.reward[0].type}
          </Text>
        </div>
        <div className='ml-6 flex-1'>
          <Text size="sm" weight="font-regular" textColor='text-gray-400' className='mb-1'>Status</Text>
          <div className='flex gap-2 items-center'>

            {mission.status === "success" ?
              <>
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M13.105 4.16496C13.3821 4.40741 13.4102 4.82859 13.1677 5.10568L7.33441 11.7723C7.09285 12.0484 6.67365 12.0775 6.39632 11.8374L2.89632 8.80705C2.61797 8.56605 2.58768 8.14502 2.82868 7.86667C3.06969 7.58831 3.49071 7.55803 3.76906 7.79903L6.76769 10.3952L12.1643 4.22767C12.4068 3.95058 12.8279 3.9225 13.105 4.16496Z" fill="#68E42D" />
                </svg>
                <Text size="lg" weight="font-regular" textColor='text-[#68E42D]' className='min-w-[40px]'>Completed</Text>
              </>
              :
              <>
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M3.52729 3.52851C3.78764 3.26816 4.20975 3.26816 4.4701 3.52851L12.4701 11.5285C12.7305 11.7889 12.7305 12.211 12.4701 12.4713C12.2098 12.7317 11.7876 12.7317 11.5273 12.4713L3.52729 4.47132C3.26694 4.21097 3.26694 3.78886 3.52729 3.52851Z" fill="#E4462D" />
                  <path fillRule="evenodd" clipRule="evenodd" d="M12.4708 3.52851C12.2104 3.26816 11.7883 3.26816 11.5279 3.52851L3.52794 11.5285C3.26759 11.7889 3.26759 12.211 3.52794 12.4713C3.78829 12.7317 4.2104 12.7317 4.47075 12.4713L12.4708 4.47132C12.7311 4.21097 12.7311 3.78886 12.4708 3.52851Z" fill="#E4462D" />
                </svg>
                <Text size="lg" weight="font-regular" textColor='text-[#E4462D]' className='min-w-[40px]'>Not Completed</Text>
              </>
              }

          </div>
        </div>
      </div>
    </div>
  )
}

export default MissionCard;