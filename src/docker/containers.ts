import { getDockerClient } from './client';
import { triggerAlert } from '../monitor/alerts';
import { logger } from '../utils/logger';

export interface ContainerData {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}

export const getRunningContainers = async (options?: { forceAlert?: boolean }): Promise<ContainerData[]> => {
  const docker = getDockerClient();
  try {
    // Try to list containers, use a timeout if possible or just catch common connection errors
    const containers = await docker.listContainers({ all: true });
    
    return containers.map((c) => {
      const name = c.Names[0]?.replace('/', '') || 'Unknown';
      const id = c.Id.substring(0, 12);

      // Check for failures (non-blocking alerts)
      if (c.State === 'restarting') {
        triggerAlert({
          id: `container:${name}:restarting`,
          type: 'container',
          severity: 'warning',
          message: `Docker container ${name} (${id}) is restarting.`,
        }, { force: options?.forceAlert });
      } else if (c.State === 'exited') {
        const match = c.Status.match(/Exited \((\d+)\)/);
        const exitCode = match ? parseInt(match[1], 10) : 0;
        
        if (exitCode !== 0) {
          triggerAlert({
            id: `container:${name}:failure`,
            type: 'container',
            severity: 'critical',
            message: `Docker container ${name} (${id}) exited with code ${exitCode}.`,
          }, { force: options?.forceAlert });
        }
      }

      return {
        id,
        name,
        image: c.Image,
        state: c.State,
        status: c.Status,
      };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to fetch Docker containers: ${errorMessage}`);
    // Throw error so UI can handle it instead of showing empty list
    throw error;
  }
};
