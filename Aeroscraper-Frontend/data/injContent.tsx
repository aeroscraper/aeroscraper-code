export const defaultContent: {
    title: string;
    desc: string;
    linkStr?: string;
    linkUrl?: string;
  }[] = [
    {
      title: "Your decentralized lending-borrowing protocol",
      desc: "Welcome to the Aeroscraper app. Here you can open a trove to borrow AUSD, earn AUSD rewards by depositing AUSD to the Stability pool, or Liquidate Risky Troves.",
    },
    {
      title: "Open your Trove and Mint AUSD",
      desc: "Open your first trove using INJ and mint AUSD. You can add or remove collaterals to your Trove later, mint more AUSD, or pay off your debt.",
    },
    {
      title: "Stake your AUSD to Stability Pool",
      desc: "Get a right to earn rewards from liquid troves by staking your AUSD to the stability pool.",
    },
    {
      title: "Rewards!",
      desc: "Collect the rewards you earned from liquid troves.",
    },
    {
      title: "The Aeroscraper audit is officially complete!",
      desc: "Security and reliability are the top priorities for Aeroscraper. Aeroscraper has been officially audited, and all errors have been corrected.",
      linkStr: "audited",
      linkUrl: "https://beosin.com/audits/Aeroscraper_202402020919.pdf",
    }
  ];
  
export const injContent: {
    title: string;
    desc: string;
    linkStr?: string;
    linkUrl?: string;
  }[] = [
    ...defaultContent,
    {
      title: "Don't miss our latest Galxe campaign",
      desc: "Get a chance to win exclusive rewards by participating in our current Galxe campaign.",
      linkStr: "participating",
      linkUrl: "https://galxe.com/aeroscraper/campaign/GCi8BtwKhx",
    },
    {
      title: "Become the member of the Aeroscraper Guild",
      desc: "Begin your Aeroscraper journey by becoming an official Guild Member. Earn exclusive roles to unlock future surprises.",
      linkStr: "unlock",
      linkUrl: "https://guild.xyz/aeroscraper",
    },
    {
      title: "Check out the Zealy missions!",
      desc: "Complete Zealy missions to raise your ranks in the leaderboard!",
      linkStr: "Zealy",
      linkUrl: "https://zealy.io/c/aeroscraper/questboard",
    },
    {
      title: "Injective Faucet",
      desc: "Get your Injective(Testnet) tokens here.",
      linkStr: "here",
      linkUrl: "https://testnet.faucet.injective.network/",
    },
  ];
