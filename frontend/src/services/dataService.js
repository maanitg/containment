// API service for fetching fire data from backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const dataService = {
  async fetchAllData() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/data/all`);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  },

  async fetchFirePerimeter() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/data/fire-perimeter`);
      if (!response.ok) {
        throw new Error(`Failed to fetch fire perimeter: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching fire perimeter:', error);
      throw error;
    }
  },

  async fetchInfrastructure() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/data/infrastructure`);
      if (!response.ok) {
        throw new Error(`Failed to fetch infrastructure: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching infrastructure:', error);
      throw error;
    }
  },

  async fetchTerrain() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/data/terrain`);
      if (!response.ok) {
        throw new Error(`Failed to fetch terrain: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching terrain:', error);
      throw error;
    }
  },

  async fetchHistoricalFires() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/data/historical-fires`);
      if (!response.ok) {
        throw new Error(`Failed to fetch historical fires: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching historical fires:', error);
      throw error;
    }
  }
};
