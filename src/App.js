import React, { useState, useEffect } from 'react';
import './App.css';
import GIPTable from './components/GIPTable.jsx';
import GIPStats from './components/GIPStats.jsx';
import { Tabs, Tab, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import yaml from 'js-yaml';


function App() {
  const [gips, setGips] = useState([]);

  const loadGIPs = async () => {
    try {
      const gipFiles = Array.from({ length: 1000 }, (_, i) => `GIP-${i + 1}.yml`);
      const fetchPromises = gipFiles.map(file =>
        fetch(`../GIPs/${file}`)
          .then(response => response.ok ? response.text() : null)
          .catch(() => null)
      );
      const fileContents = await Promise.all(fetchPromises);
      const parsedGips = fileContents
        .filter(content => content !== null)
        .map(content => {
          try {
            return yaml.load(content);
          } catch (e) {
            console.error("Error parsing YAML:", e);
            return null;
          }
        })
        .filter(gip => gip !== null && typeof gip === 'object');
      setGips(parsedGips);
    } catch (error) {
      console.error("Error loading GIPs:", error);
    }
  };

  useEffect(() => {
    loadGIPs();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1 style={{ fontSize: '80px' }} >Gnosis Governance Dashboard</h1>
      </header>
        <Tabs>
          <TabList>
            <Tab>Overview</Tab>
            <Tab>Stats</Tab>
          </TabList>

          <TabPanel>
             <GIPTable gips={gips} />
          </TabPanel>
          <TabPanel>
            <GIPStats gips={gips} />
          </TabPanel>
        </Tabs>
    </div>
  );
}

export default App;
