import axios from 'axios';

// Use relative URL for API to allow Nginx proxying
// This fixes CORS issues by treating backend as a same-origin path
const API_URL = '/api';

// Derive WS URL from window location
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
export const WS_URL = `${protocol}//${window.location.host}/api/ws`;

export const api = axios.create({
    baseURL: API_URL,
});

export const fetchFeed = async (userId, cursor = 0) => {
    const response = await api.get(`/feed?user_id=${userId}&cursor=${cursor}`);
    return response.data;
};

export const trackInteraction = async (data) => {
    const response = await api.post('/track', data);
    return response.data;
};

export const seedContent = async () => {
    return await api.post('/seed');
};

export const fetchDashboardInterests = async (userId) => {
    const response = await api.get(`/dashboard/interests/${userId}`);
    return response.data;
};

export const fetchRecentActivity = async () => {
    const response = await api.get('/dashboard/recent-activity');
    return response.data;
};
