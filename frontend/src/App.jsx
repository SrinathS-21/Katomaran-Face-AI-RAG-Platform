import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppBar, Toolbar, Typography, Container, Tabs, Tab, Box } from '@mui/material';
import FaceIcon from '@mui/icons-material/Face';

import FaceRegistration from './components/FaceRegistration';
import LiveRecognition from './components/LiveRecognition';
import ChatInterface from './components/ChatInterface';
import './App.css';

// Create Material-UI theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function App() {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="App">
        <AppBar position="static">
          <Toolbar>
            <FaceIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Katomaran Face AI & RAG Platform
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ mt: 2 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="platform tabs">
              <Tab label="Face Registration" />
              <Tab label="Live Recognition" />
              <Tab label="AI Chat" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <FaceRegistration />
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            <LiveRecognition />
          </TabPanel>
          <TabPanel value={tabValue} index={2}>
            <ChatInterface />
          </TabPanel>
        </Container>
      </div>
    </ThemeProvider>
  );
}

export default App;
