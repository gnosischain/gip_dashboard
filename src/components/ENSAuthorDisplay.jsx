import React, { useState, useEffect } from 'react';

const isEthereumAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

const ENSAuthorDisplay = ({ author }) => {
  const [ensName, setEnsName] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchEnsName = async () => {
      if (!isEthereumAddress(author)) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`https://api.ensideas.com/ens/resolve/${author}`);
        const data = await response.json();
        if (data.name) {
          setEnsName(data.name);
        }
      } catch (error) {
        console.error('Error fetching ENS name:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEnsName();
  }, [author]);

  if (!author) return null;

  if (isLoading) {
    return <span className="text-gray-500">Loading...</span>;
  }

  // If it's an Ethereum address, show ENS or truncated address
  if (isEthereumAddress(author)) {
    return ensName ? (
      <span className="text-blue-600">{ensName}</span>
    ) : (
      <span className="text-gray-600">{`${author.substring(0, 6)}...${author.substring(38)}`}</span>
    );
  }

  // If it's not an Ethereum address, just return the author name
  return <span>{author}</span>;
};

export default ENSAuthorDisplay;