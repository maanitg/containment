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
  },

  async processLiveData(timeIndex) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/process-live-data/${timeIndex}`, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error(`Failed to process live data: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error processing live data:', error);
      throw error;
    }
  },

  async fetchNotifications(limit = 20, offset = 0) {
    try {
      const url = `${API_BASE_URL}/api/notifications?limit=${limit}&offset=${offset}`;
      console.log(`[dataService] Fetching from: ${url}`);
      const response = await fetch(url);
      console.log(`[dataService] Response status: ${response.status}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch notifications: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      console.log(`[dataService] Received data:`, data);
      return data;
    } catch (error) {
      console.error('[dataService] Error fetching notifications:', error);
      throw error;
    }
  },

  async fetchLatestRecommendation() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/recommendations/latest`);
      if (!response.ok) {
        throw new Error(`Failed to fetch recommendation: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching recommendation:', error);
      throw error;
    }
  },

  async resetNotifications() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/reset-notifications`, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error(`Failed to reset notifications: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error resetting notifications:', error);
      throw error;
    }
  }
};
