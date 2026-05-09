import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { getRunningPods, PodData } from '../kubernetes/pods';
import { getRunningContainers, ContainerData } from '../docker/containers';

const StatusBadge = ({ status, type }: { status: string, type: 'pod' | 'container' }) => {
  const isRunning = type === 'pod' ? status === 'Running' : status === 'running';
  const bgColor = isRunning ? 'green' : (status === 'Pending' || status === 'restarting' ? 'yellow' : 'red');
  const textColor = isRunning || bgColor === 'yellow' ? 'black' : 'white';

  return (
    <Box backgroundColor={bgColor} paddingX={1}>
      <Text color={textColor} bold>
        {status.toUpperCase()}
      </Text>
    </Box>
  );
};

export const WatchDashboard = () => {
  const [pods, setPods] = useState<PodData[]>([]);
  const [containers, setContainers] = useState<ContainerData[]>([]);
  const [error, setError] = useState<{ type: string; message: string } | null>(null);

  useEffect(() => {
    const fetchPods = async () => {
      try {
        const p = await getRunningPods();
        setPods(p);
        setError(prev => prev?.type === 'k8s' ? null : prev);
      } catch (err) {
        setError({ type: 'k8s', message: (err as Error).message });
      }
    };

    const fetchContainers = async () => {
      try {
        const c = await getRunningContainers();
        setContainers(c);
        setError(prev => prev?.type === 'docker' ? null : prev);
      } catch (err) {
        setError({ type: 'docker', message: (err as Error).message });
      }
    };

    const fetchData = () => {
      fetchPods();
      fetchContainers();
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text color="cyan" bold> 󱔎 KDM Live Dashboard </Text>
        </Box>
        <Box>
          <Text dimColor>(Press Ctrl+C to exit)</Text>
        </Box>
      </Box>

      {error && (
        <Box marginBottom={1} paddingX={1} backgroundColor="red">
          <Text color="white" bold> ERROR: {error.type.toUpperCase()} - {error.message} </Text>
        </Box>
      )}
      
      <Box flexDirection="row">
        <Box flexDirection="column" width="50%" paddingRight={2}>
          <Box borderStyle="single" borderColor="blue" paddingX={1} marginBottom={1}>
            <Text color="blue" bold>Kubernetes Pods ({pods.length})</Text>
          </Box>
          {pods.length === 0 && !error?.type.includes('k8s') ? (
            <Text color="gray">  No pods found.</Text>
          ) : (
            pods.map(p => (
              <Box key={p.name} flexDirection="row" justifyContent="space-between" marginBottom={0}>
                <Text> {p.name.length > 25 ? p.name.substring(0, 22) + '...' : p.name}</Text>
                <StatusBadge status={p.status} type="pod" />
              </Box>
            ))
          )}
        </Box>

        <Box flexDirection="column" width="50%">
          <Box borderStyle="single" borderColor="blue" paddingX={1} marginBottom={1}>
            <Text color="blue" bold>Docker Containers ({containers.length})</Text>
          </Box>
          {containers.length === 0 && !error?.type.includes('docker') ? (
            <Text color="gray">  No containers found.</Text>
          ) : (
            containers.map(c => (
              <Box key={c.id} flexDirection="row" justifyContent="space-between" marginBottom={0}>
                <Text> {c.name.length > 25 ? c.name.substring(0, 22) + '...' : c.name}</Text>
                <StatusBadge status={c.state} type="container" />
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
};
