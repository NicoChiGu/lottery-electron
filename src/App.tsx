import { useEffect, useRef, useState, useMemo, forwardRef } from "react";
import {
  Button,
  TextField,
  Stack,
  Typography,
  Paper,
  Box,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Zoom,
} from "@mui/material";

/** --- 类型定义 --- */
interface DrawRound {
  round: number;
  time: string;
  codes: string[];
}

interface LotteryState {
  start: string;
  end: string;
  count: number | "";
  history: DrawRound[];
}

const STORAGE_KEY = "lottery-state-v3";

const Transition = forwardRef(function Transition(props: any, ref) {
  return <Zoom ref={ref} {...props} />;
});

/** --- 响应式样式逻辑：优化 14 人以上的显示 --- */
const getResponsiveStyle = (count: number) => {
  // 1人：巨型
  if (count <= 1) return { fontSize: "12rem", gridCols: "1fr", minWidth: "300px" };
  // 2-4人：大型
  if (count <= 4) return { fontSize: "6rem", gridCols: "1fr 1fr", minWidth: "200px" };
  // 5-12人：标准
  if (count <= 12) return { fontSize: "3.5rem", gridCols: "repeat(auto-fit, minmax(180px, 1fr))", minWidth: "150px" };
  // 13-20人：新增档位，确保 14-15 人时不至于太小
  if (count <= 20) return { fontSize: "3.5rem", gridCols: "repeat(auto-fit, minmax(180px, 1fr))", minWidth: "120px" };
  // 21-35人：中型
  if (count <= 35) return { fontSize: "3.5rem", gridCols: "repeat(auto-fit, minmax(180px, 1fr))", minWidth: "100px" };
  // 35人以上：保底字号提升
  return { fontSize: "3.5rem", gridCols: "repeat(auto-fit, minmax(180px, 1fr))", minWidth: "80px" };
};

export default function App() {
  const [start, setStart] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).start : "0000";
  });
  const [end, setEnd] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).end : "0165";
  });
  const [count, setCount] = useState<number | "">(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).count : 1;
  });
  const [history, setHistory] = useState<DrawRound[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).history : [];
  });

  const [display, setDisplay] = useState<string[]>([]);
  const [rolling, setRolling] = useState(false);
  const [openResetModal, setOpenResetModal] = useState(false);

  const rollingTimer = useRef<number | null>(null);
  const currentPool = useRef<string[]>([]);

  const { fontSize, gridCols, minWidth } = useMemo(() => getResponsiveStyle(display.length), [display.length]);
  const allDrawnCodes = useMemo(() => history.flatMap((h) => h.codes), [history]);

  const currentAvailablePool = useMemo(() => {
    const s = parseInt(start, 10);
    const e = parseInt(end, 10);
    const len = start.length;
    if (isNaN(s) || isNaN(e) || start.length !== end.length || s > e) return [];
    const pool: string[] = [];
    for (let i = s; i <= e; i++) {
      const code = i.toString().padStart(len, "0");
      if (!allDrawnCodes.includes(code)) pool.push(code);
    }
    return pool;
  }, [start, end, allDrawnCodes]);

  const remainingCount = currentAvailablePool.length;
  
  // 校验逻辑：现在不再阻塞“开ROLL”，只在人数为空或0时禁用
  const isLengthMismatch = start !== "" && end !== "" && start.length !== end.length;
  const isCountInvalid = count === "" || count === 0;
  const isOverLimit = !isCountInvalid && (count as number) > remainingCount;
  const isSettingsInvalid = isLengthMismatch || start === "" || end === "" || parseInt(start) > parseInt(end);

  useEffect(() => {
    const state: LotteryState = { start, end, count, history };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [start, end, count, history]);

  const startDraw = () => {
    if (rolling || isSettingsInvalid || isCountInvalid || remainingCount === 0) return;
    
    // 核心逻辑修改：如果设定人数超过剩余人数，则只抽取剩余的所有人
    const actualCount = Math.min(count as number, remainingCount);
    
    currentPool.current = currentAvailablePool;
    setRolling(true);
    rollingTimer.current = window.setInterval(() => {
      // 预览时也按照实际能抽的人数展示
      const temp = Array.from({ length: actualCount }, () => 
        currentAvailablePool[Math.floor(Math.random() * currentAvailablePool.length)]
      );
      setDisplay(temp);
    }, 50);
  };

  const stopDraw = () => {
    if (!rolling || !rollingTimer.current) return;
    clearInterval(rollingTimer.current);
    rollingTimer.current = null;

    const actualCount = Math.min(count as number, remainingCount);
    const pool = [...currentPool.current];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    
    const picked = pool.slice(0, actualCount);
    const newRound: DrawRound = {
      round: history.length + 1,
      time: new Date().toLocaleTimeString(),
      codes: picked,
    };
    setHistory([newRound, ...history]);
    setDisplay(picked);
    setRolling(false);
  };

  const handleResetConfirm = () => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
    setDisplay([]);
    setRolling(false);
    setOpenResetModal(false);
  };

  return (
    <Stack sx={{ height: "100vh", p: 4, alignItems: "center", bgcolor: "#111", overflow: "hidden" }} spacing={3}>
      <Typography variant="h3" color="white" fontWeight={900} sx={{ letterSpacing: 4 }}>
        年年的会抽抽的奖
      </Typography>

      <Paper elevation={0} sx={{
        flex: 1, width: "100%", maxWidth: "100", minHeight: 0,
        bgcolor: "rgba(255,255,255,0.02)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)",
        p: 4, overflowY: "auto", display: "flex", flexDirection: "column",
        justifyContent: display.length <= 10 ? "center" : "flex-start",
        alignItems: "center",
        "&::-webkit-scrollbar": { width: "8px" },
        "&::-webkit-scrollbar-thumb": { backgroundColor: "#333", borderRadius: "10px" }
      }}>
        <Box sx={{ 
          display: "grid", gridTemplateColumns: gridCols, gap: 3, width: "100%", 
          justifyItems: "center", alignContent: "center", 
        }}>
          {display.map((num, i) => (
            <Box key={i} sx={{
              display: "flex", alignItems: "center", justifyContent: "center",
              minWidth: minWidth, aspectRatio: "16 / 9", fontSize: fontSize,
              fontWeight: 900, color: "#ffeb3b", borderRadius: 4,
              background: "linear-gradient(145deg, #222, #050505)", border: "3px solid #ffeb3b",
              boxShadow: "0 10px 40px rgba(0,0,0,0.6)", textShadow: "0 0 20px rgba(255,235,59,0.4)",
            }}>{num}</Box>
          ))}
        </Box>
      </Paper>

      {/* 历史记录 */}
      <Box sx={{ width: "100%", maxWidth: "1400px", height: "180px", display: "flex", flexDirection: "column" }}>
        <Typography variant="overline" color="gray">历史记录 | 剩余池: {remainingCount}</Typography>
        <Stack spacing={1} sx={{ flex: 1, overflowY: "auto", pr: 1, "&::-webkit-scrollbar": { width: "6px" }, "&::-webkit-scrollbar-thumb": { backgroundColor: "#333", borderRadius: "10px" } }}>
          {history.map((item) => (
            <Paper key={item.round} sx={{ p: 1.5, bgcolor: "#1a1a1a", border: "1px solid #333", borderLeft: "4px solid #ffeb3b", display: "flex", alignItems: "center", gap: 3 }}>
              <Box sx={{ minWidth: "120px" }}>
                <Typography variant="subtitle2" color="#ffeb3b">第 {item.round} 轮</Typography>
                <Typography variant="caption" color="gray">{item.time}</Typography>
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, flex: 1 }}>
                {item.codes.map((c) => (
                  <Typography key={c} sx={{ px: 1, py: 0.2, bgcolor: "rgba(255,235,59,0.1)", color: "#eee", borderRadius: 1, fontSize: "0.85rem" }}>{c}</Typography>
                ))}
              </Box>
            </Paper>
          ))}
        </Stack>
      </Box>

      {/* 控制面板 */}
      <Stack direction="row" spacing={3} alignItems="flex-start" sx={{ bgcolor: "#2c2c2c", p: 3, borderRadius: 4, border: "1px solid #444" }}>
        <TextField 
          label="起始" size="small" value={start} error={start === "" || isLengthMismatch}
          onChange={(e) => setStart(e.target.value.replace(/\D/g, ""))} 
          sx={{ width: 100, "& .MuiInputBase-input": { color: "white" } }} 
        />
        <TextField 
          label="结束" size="small" value={end} error={end === "" || isLengthMismatch}
          onChange={(e) => setEnd(e.target.value.replace(/\D/g, ""))} 
          sx={{ width: 100, "& .MuiInputBase-input": { color: "white" } }} 
        />
        <TextField 
          label="人数" 
          size="small" value={count}
          error={isCountInvalid || isOverLimit}
          color={isOverLimit ? "warning" : "primary"}
          helperText={isOverLimit ? `池内仅剩 ${remainingCount} 人` : isCountInvalid ? "必填" : ""}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "");
            setCount(val === "" ? "" : parseInt(val));
          }}
          sx={{ width: 160, "& .MuiInputBase-input": { color: "white" } }}
        />

        <Divider orientation="vertical" flexItem sx={{ bgcolor: "#555", mx: 1 }} />

        <Button 
            variant="contained" 
            size="large" 
            disabled={rolling || isSettingsInvalid || isCountInvalid || remainingCount === 0} 
            onClick={startDraw} 
            sx={{ height: 40, fontWeight: "bold", bgcolor: isOverLimit ? "#ffa726" : "#ffeb3b", color: "#000", "&:hover": { bgcolor: "#fdd835" } }}
        >
            {isOverLimit ? "开ROLL"+`(剩余${remainingCount})` : "开ROLL"}
        </Button>
        <Button variant="contained" color="warning" size="large" disabled={!rolling} onClick={stopDraw} sx={{ height: 40, fontWeight: "bold" }}>停止</Button>
        <Button color="error" variant="contained" disabled={rolling} onClick={() => setOpenResetModal(true)} sx={{ height: 40 }}>重置</Button>
      </Stack>

      <Dialog open={openResetModal} TransitionComponent={Transition} onClose={() => setOpenResetModal(false)} PaperProps={{ sx: { bgcolor: "#1a1a1a", border: "1px solid #ff1744", borderRadius: 4 } }}>
        <DialogTitle sx={{ color: "#ff1744", fontWeight: "bold" }}>危险操作</DialogTitle>
        <DialogContent><DialogContentText sx={{ color: "#eee" }}>确定要重置所有记录吗？</DialogContentText></DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: "center" }}>
          <Button onClick={() => setOpenResetModal(false)} sx={{ color: "gray" }}>取消</Button>
          <Button onClick={handleResetConfirm} variant="contained" color="error">确定重置</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}