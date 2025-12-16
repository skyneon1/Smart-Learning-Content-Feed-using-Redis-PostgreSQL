import { useState, useEffect, useCallback, useRef } from 'react';
import { useInView } from 'react-intersection-observer'; // uuid removed
import { fetchFeed, trackInteraction, seedContent } from './api';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Chip,
    CircularProgress,
    Dialog,
    IconButton,
    Button
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TopicIcon from '@mui/icons-material/Topic';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

const FeedItem = ({ item, onClick, onVisible }) => {
    const { ref, inView } = useInView({ threshold: 0.5 });
    const timerRef = useRef(null);
    const startTimeRef = useRef(null);

    useEffect(() => {
        if (inView) {
            startTimeRef.current = Date.now();
            timerRef.current = setInterval(() => { }, 1000); // keep alive
        } else {
            if (startTimeRef.current) {
                const duration = (Date.now() - startTimeRef.current) / 1000;
                if (duration > 1) onVisible(item.id, duration);
                startTimeRef.current = null;
            }
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [inView, item.id, onVisible]);

    return (
        <Card
            ref={ref}
            onClick={() => onClick(item)}
            sx={{
                mb: 3,
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                position: 'relative'
            }}
        >
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Chip
                        label={item.topic}
                        size="small"
                        color="secondary"
                        variant="outlined"
                        icon={<TopicIcon />}
                        sx={{ mb: 1.5 }}
                    />
                    {item.score && (
                        <Chip
                            label={`Score: ${item.score.toFixed(2)}`}
                            size="small"
                            icon={<EmojiEventsIcon />}
                            sx={{ opacity: 0.7 }}
                        />
                    )}
                </Box>

                <Typography variant="h5" component="div" fontWeight="bold" gutterBottom>
                    {item.title}
                </Typography>

                <Box display="flex" alignItems="center" color="text.secondary" gap={1}>
                    <AccessTimeIcon fontSize="small" />
                    <Typography variant="body2">
                        {item.estimated_read_time ? `${Math.ceil(item.estimated_read_time / 60)} min read` : 'Read now'}
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
};

const Reader = ({ item, userId, onClose }) => {
    const [scrollDepth, setScrollDepth] = useState(0);
    const [startTime] = useState(Date.now());
    const contentRef = useRef(null);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const scrollPercent = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
        setScrollDepth(prev => Math.max(prev, scrollPercent));
    };

    useEffect(() => {
        return () => {
            const endTime = Date.now();
            const timeSpent = (endTime - startTime) / 1000;
            if (timeSpent > 2) {
                trackInteraction({
                    user_id: userId,
                    content_id: item.id,
                    time_spent: Math.round(timeSpent),
                    scroll_depth: scrollDepth,
                    skipped: timeSpent < 5 && scrollDepth < 10
                }).catch(console.error);
            }
        };
    }, []); // eslint-disable-line

    return (
        <Dialog open fullScreen onClose={onClose}>
            <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, height: '4px', bgcolor: 'background.paper', zIndex: 9999 }}>
                <Box sx={{ height: '100%', width: `${scrollDepth}%`, bgcolor: 'primary.main', transition: 'width 0.1s' }} />
            </Box>

            <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close">
                    <CloseIcon />
                </IconButton>
            </Box>

            <Box
                sx={{ p: 4, maxWidth: '800px', mx: 'auto', overflowY: 'auto', height: '100%' }}
                onScroll={handleScroll}
                ref={contentRef}
            >
                <Chip label={item.topic} color="primary" sx={{ mb: 2 }} />
                <Typography variant="h3" gutterBottom fontWeight="800">
                    {item.title}
                </Typography>

                <Button href={item.url} target="_blank" variant="outlined" sx={{ mb: 4 }}>
                    Visit Original Source
                </Button>

                <Typography variant="body1" paragraph sx={{ fontSize: '1.2rem', lineHeight: 1.8 }}>
                    {/* Placeholder Content */}
                    {Array(15).fill(0).map((_, i) => (
                        <span key={i} style={{ display: 'block', marginBottom: '20px' }}>
                            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                        </span>
                    ))}
                </Typography>

                <Box sx={{ p: 4, textAlign: 'center', opacity: 0.5 }}>
                    <Typography>End of content</Typography>
                </Box>
            </Box>
        </Dialog>
    );
};

export default function Feed() {
    const [items, setItems] = useState([]);
    const [cursor, setCursor] = useState(0);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [userId] = useState(() => {
        let uid = localStorage.getItem('userId');
        if (!uid) {
            uid = Math.random().toString(36).substring(2, 15);
            localStorage.setItem('userId', uid);
        }
        return uid;
    });
    const [readingItem, setReadingItem] = useState(null);

    useEffect(() => {
        seedContent().catch(() => { });
    }, []);

    const loadMore = useCallback(async () => {
        if (loading || !hasMore) return;
        setLoading(true);
        try {
            const data = await fetchFeed(userId, cursor);
            if (data.items.length === 0) setHasMore(false);
            else {
                setItems(prev => [...prev, ...data.items]);
                if (data.next_cursor) setCursor(data.next_cursor);
                else setHasMore(false);
            }
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [cursor, loading, hasMore, userId]);

    useEffect(() => {
        loadMore();
    }, []); // eslint-disable-line

    const { ref: loaderRef, inView } = useInView();
    useEffect(() => {
        if (inView) loadMore();
    }, [inView, loadMore]);

    return (
        <Box maxWidth="md" mx="auto">
            <Typography variant="h4" gutterBottom fontWeight="bold">
                Your Learning Feed
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
                Recommended based on your reading time and completion.
            </Typography>

            {items.map(item => (
                <FeedItem
                    key={item.id}
                    item={item}
                    onClick={setReadingItem}
                    onVisible={() => { }}
                />
            ))}

            <Box ref={loaderRef} display="flex" justifyContent="center" p={4}>
                {loading && <CircularProgress />}
                {!hasMore && items.length > 0 && <Typography color="text.secondary">You're all caught up!</Typography>}
            </Box>

            {readingItem && (
                <Reader item={readingItem} userId={userId} onClose={() => setReadingItem(null)} />
            )}
        </Box>
    );
}
