import React, { useEffect, useRef, useState } from 'react'
import Text from '@/components/Texts/Text';
import { Table } from '@/components/Table/Table';
import { TableBodyCol } from '@/components/Table/TableBodyCol';
import { TableHeaderCol } from '@/components/Table/TableHeaderCol';
import { getCroppedString } from '@/utils/stringUtils';
import { NumericFormat } from 'react-number-format';
import SkeletonLoading from '@/components/Table/SkeletonLoading';
import useChainAdapter from '@/hooks/useChainAdapter';

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

interface Account {
  id: string;
  userId: string;
  authentification: string;
  createdAt: string;
  updatedAt: string;
  accountType: string;
  verified: boolean;
  tokenStatus: string;
}

interface ZealyUserInformation {
  xp: number;
  rank: number;
  invites: number;
  role: string;
  level: number;
  isBanned: boolean;
  karma: number;
  accounts: Account[];
  ethWallet: string;
  isMe: boolean;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  addresses: Record<string, any>;
  avatar: string;
  discordHandle: string;
  twitterUsername: string;
  displayedInformation: string[];
  deletedAt: string | null;
  accountLinkingInformation: { linkType: string; count: number }[];
}

const LeaderboardTab = () => {

  const ref = useRef<any>();

  const { address } = useChainAdapter();

  const [leaderboard, setLeaderboard] = useState<ZealyUser[]>([]);
  const [userInformation, setUserInformation] = useState<ZealyUserInformation | null>(null);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);

  const [informationLoading, setInformationLoading] = useState(false);

  const [loading, setLoading] = useState(true);

  const [zealyId, setZealyId] = useState<string | null>(null);

  useEffect(() => {
    getUserId();
    getLeaderboardList();
  }, []);

  useEffect(() => {
    if (zealyId) {
      getUserInformation();
    }
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

      if (data.items.length > 0) {
        setZealyId(data.items[0].userId);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const getLeaderboardList = async () => {
    try {
      const result = await fetch("/api/zealy/leaderboard",
        {
          next: {
            revalidate: false
          },
          cache: 'no-cache'
        });

      const data: ZealyResponseModel = await result.json();

      setTotalUsers(data.totalUsers);
      setLeaderboard(data.items);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const getUserInformation = async () => {
    setInformationLoading(true);

    try {
      const result = await fetch(`/api/zealy/userInformation/${zealyId}`,
        {
          next: {
            revalidate: 0
          },
          cache: 'no-store'
        });

      const data = await result.json();

      setUserInformation(data)
      setInformationLoading(false);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  return (
    <div ref={ref}>
      <Text size='3xl'>See your ranking among users</Text>
      <Text size='base' weight='font-regular' className='mt-1'>Earn points and increase your ranking</Text>
      {
         (
          <>
            <div className="w-full bg-cetacean-dark-blue border border-white/10 rounded-2xl px-6 py-6 flex items-end justify-between mt-6">
              <div className='w-full'>
                <Text size="base" weight="font-bold">Your Rank</Text>
                <div className='mt-6 flex justify-between w-full'>
                  {informationLoading ?
                    <SkeletonLoading height='h-4 mt-6' width='w-24' noPadding />
                    :
                    <div className='flex items-end'>
                      <Text size="5xl" textColor='text-gradient' weight='font-semibold'>
                        {userInformation?.rank ?? "-"}
                      </Text>
                      <Text size="sm" weight="font-regular" textColor='text-gray-400' className='ml-3 mb-1'>of {totalUsers} wallets</Text>
                    </div>
                  }
                  <div className='flex items-end'>
                    <Text size="2xl" textColor='text-white' weight='font-semibold'>
                      {userInformation?.xp ?? "-"}
                    </Text>
                    <Text size="sm" weight="font-regular" textColor='text-gray-400' className='ml-2 mb-1'>points</Text>
                  </div>
                </div>
              </div>
            </div>
            <Table
              listData={leaderboard}
              header={<div className="grid-cols-6 grid gap-5 lg:gap-0 mt-4 md:mr-0 mr-6">
                <TableHeaderCol col={1} text="Rank" />
                <TableHeaderCol col={4} text="Address" />
                <TableHeaderCol col={1} text="Points" textCenter />
              </div>}
              bodyCss='space-y-1 max-h-[350px] overflow-auto'
              loading={loading}
              renderItem={(item: ZealyUser, idx) => {
                return <div key={item.userId} className="grid grid-cols-6 border-b border-white/10">
                  <TableBodyCol col={1} text="XXXXXX" value={
                    <Text size='sm' className='whitespace-nowrap text-start ml-4'>{idx + 1}</Text>
                  } />
                  <TableBodyCol col={4} text="XXXXXX" value={
                    <Text size='sm' className='whitespace-nowrap text-start ml-4'>{getCroppedString(item.address, 6, 8)}</Text>
                  } />
                  <TableBodyCol col={1} text="XXXXXX" value={
                    <NumericFormat
                      value={item.xp}
                      thousandsGroupStyle="thousand"
                      thousandSeparator=","
                      fixedDecimalScale
                      decimalScale={0}
                      displayType="text"
                      renderText={(value) =>
                        <Text size='sm' responsive={false} className='whitespace-nowrap'>{value} xp</Text>
                      }
                    />} />

                </div>
              }} />
          </>
        )
      }
    </div>
  )
}

export default LeaderboardTab;