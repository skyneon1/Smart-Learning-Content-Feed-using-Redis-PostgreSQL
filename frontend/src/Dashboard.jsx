import { useState, useEffect, useRef } from 'react';
import {
    Grid,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Box,
    CircularProgress
} from '@mui/material';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { fetchDashboardInterests, fetchRecentActivity, WS_URL } from './api';

// Utility to get or create UserID
const getUserId = () => {
    let uid = localStorage.getItem('userId');
    if (!uid) {
        uid = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('userId', uid);
    }
    return uid;
};

export default function Dashboard() {
    const [userId] = useState(getUserId); // Use the robust getter
    const [interests, setInterests] = useState([]);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    const ws = useRef(null);

    // Initial load
    useEffect(() => {
        const loadData = async () => {
            try {
                const [ints, acts] = await Promise.all([
                    fetchDashboardInterests(userId),
                    fetchRecentActivity()
                ]);

                if (ints) {
                    const chartData = Object.entries(ints).map(([topic, score]) => ({
                        name: topic,
                        score: parseFloat(score.toFixed(2))
                    }));
                    setInterests(chartData);
                }
                if (acts) {
                    setActivities(acts);
                }
            } catch (e) {
                console.error("Dashboard Load Error:", e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [userId]);

    // WebSocket Connection
    useEffect(() => {
        ws.current = new WebSocket(WS_URL);

        ws.current.onopen = () => console.log('WS Connected');

        ws.current.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'new_interaction') {
                const newAct = message.data;
                // Prepend new activity
                setActivities(prev => [newAct, ...prev].slice(0, 10));

                // Optimistically update chart (or re-fetch)
                fetchDashboardInterests(userId).then(ints => {
                    const chartData = Object.entries(ints).map(([topic, score]) => ({
                        name: topic,
                        score: parseFloat(score.toFixed(2))
                    }));
                    setInterests(chartData);
                });
            }
        };

        return () => {
            if (ws.current) ws.current.close();
        };
    }, [userId]);

    if (loading) return <Box display="flex" justifyContent="center" p={10}><CircularProgress /></Box>;

    return (
        <Box>
            <Typography variant="h4" gutterBottom fontWeight="bold">Dashboard</Typography>

            <Grid container spacing={3}>
                {/* Interest Chart */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, height: '400px', display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h6" gutterBottom>Your Topic Interests</Typography>
                        <Box sx={{ flexGrow: 1, width: '100%', minHeight: 0 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={interests}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="score" fill="#38bdf8" />
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    </Paper>
                </Grid>

                {/* Stats */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, height: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Typography variant="h6" gutterBottom>Metrics</Typography>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="h3" color="primary">{activities.length}</Typography>
                            <Typography variant="body2" color="text.secondary">Global Interactions Tracked</Typography>
                        </Box>
                        <Box>
                            <Typography variant="h3" color="secondary">{interests.length}</Typography>
                            <Typography variant="body2" color="text.secondary">Active Topics</Typography>
                        </Box>
                    </Paper>
                </Grid>

                {/* Recent Activity Table */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>Recent Backend Activity</Typography>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Time</TableCell>
                                        <TableCell>Topic</TableCell>
                                        <TableCell>Title</TableCell>
                                        <TableCell align="right">Time Spent (s)</TableCell>
                                        <TableCell align="right">Scroll (%)</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {activities.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell>{new Date(row.timestamp).toLocaleTimeString()}</TableCell>
                                            <TableCell>{row.topic}</TableCell>
                                            <TableCell>{row.content_title}</TableCell>
                                            <TableCell align="right">{row.time_spent}</TableCell>
                                            <TableCell align="right">{row.scroll_depth}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
