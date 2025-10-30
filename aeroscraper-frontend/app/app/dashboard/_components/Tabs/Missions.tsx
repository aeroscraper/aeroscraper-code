import React, { useEffect, useRef, useState } from 'react'
import Text from '@/components/Texts/Text';
import SkeletonLoading from '@/components/Table/SkeletonLoading';
import MissionCard, { ZealyMission } from '@/components/MissionCard';
import { isNil } from 'lodash';
import useChainAdapter from '@/hooks/useChainAdapter';
import Link from 'next/link';

interface ZealyResponseModel {
  items: ZealyUser[],
  totalUsers: number,
  totalPages: number,
  page: number
}

interface ZealyUser {
  userId: string;
  xp: number;
  name: string;
  avatar: string;
  numberOfQuests: number;
  addresses: Record<string, any>;
  address: string;
  twitterId: string;
  discord: string;
  twitter: string;
  discordId: string;
  connectedWallet: string;
}

const MissionsTab = () => {

  const ref = useRef<any>();

  const { address } = useChainAdapter();

  const [missionList, setMissionList] = useState<Record<string, ZealyMission> | null>(null);

  const [zealyId, setZealyId] = useState<string | null>(null);

  useEffect(() => {
    getUserId();
  }, []);

  useEffect(() => {
    !isNil(zealyId) && getZealyClaimedMissions();
  }, [zealyId]);

  const getUserId = async () => {
    try {
      const result = await fetch(`https://db.aeroscraper.io/api/collections/leaderboard/records?filter=address="${address}"`,
        {
          next: {
            revalidate: false
          },
          cache: 'no-cache'
        });

      const data: ZealyResponseModel = await result.json();

      setZealyId(data?.items[0]?.userId ?? "null");

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const getZealyClaimedMissions = async () => {
    try {
      const result: any = await fetch(`/api/zealy/claimedMissions/${zealyId}`,
        {
          next: {
            revalidate: 0
          },
          cache: 'no-cache',
          method: "GET"
        });

      if (!result.ok) {
        throw new Error('Network response was not ok.');
      }

      const parseData = await result.json();

      if (typeof parseData !== "object") {
        throw new Error('Network response was not ok.');
      }

      setMissionList(parseData);
      console.log(parseData);

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  return (
    <div ref={ref}>
      <Text size='3xl'>Missions at
        <Link
          target={"_blank"}
          href={"https://zealy.io/c/aeroscraper/questboard"}
          className="text-[#F8B810] animate-pulse ml-2 font-medium"
        >
          Zealy
        </Link>
      </Text>      
      {
        isNil(missionList) ?
          (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {
                new Array(6).fill({}).map((_item, idx) => {
                  return <div key={idx} className="w-full bg-cetacean-dark-blue border border-white/10 rounded-2xl px-4 pt-4 pb-4 items-end justify-between mt-6">
                    <div className='w-full flex justify-between gap-6 items-center'>
                      <SkeletonLoading height='h-6 mt-6' width='w-32' noPadding />
                      <div
                        className={`px-8 pb-1 m-1 text-base font-medium text-white relative cursor-pointer rounded-md hover:text-red-500 duration-700 whitespace-nowrap text-center`}
                      >
                        <SkeletonLoading height='h-4 mt-6' width='w-24' noPadding />
                        <div className="absolute bottom-0 h-[40px] border-2 rounded-md border-red-500 left-0 right-0" />
                      </div>
                    </div>
                    <SkeletonLoading height='h-4 mt-6' width='w-full' noPadding />
                    <SkeletonLoading height='h-4 mt-6' width='w-full' noPadding />
                    <div className='mt-4'>
                      <Text size="sm" weight="font-regular" textColor='text-gray-400' className='mb-1'>Points</Text>
                      <Text size="xl" textColor='text-gradient' weight='font-medium'>
                        <SkeletonLoading height='h-4 mt-2' width='w-24' noPadding />
                      </Text>
                    </div>
                  </div>

                })
              }
            </div>
          )
          :
          (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-6'>
              {Object.values(missionList)?.map((mission, idx) => {
                return <MissionCard key={idx} mission={mission} />
              })}
            </div>
          )
      }
    </div>
  )
}

export default MissionsTab;