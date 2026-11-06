import { useEffect, useMemo, useState } from "react";
import {
  Alert, AppBar, Box, Button, Chip, CssBaseline, Divider, Drawer, IconButton,
  InputAdornment, LinearProgress, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, ThemeProvider, Toolbar, Tooltip, Typography, createTheme
} from "@mui/material";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import TravelExploreOutlined from "@mui/icons-material/TravelExploreOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import SpellcheckOutlined from "@mui/icons-material/SpellcheckOutlined";
import TipsAndUpdatesOutlined from "@mui/icons-material/TipsAndUpdatesOutlined";
import CompareArrowsOutlined from "@mui/icons-material/CompareArrowsOutlined";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import products from "./data/products.json";
import initialSearches from "./data/searches.json";
import vocabulary from "./data/controlledVocabulary.json";
import {
  collectVocabularyGaps, createRecommendations, groupQueries, mergeSearches,
  normalizeQuery, rankProducts, recordSearch, SCORE_WEIGHTS, simulateFix
} from "./utils/searchIntelligence.js";

const drawerWidth = 238;
const navItems = [
  { id: "overview", label: "Overview", icon: DashboardOutlined },
  { id: "zero-results", label: "Zero Results", icon: SearchOutlined },
  { id: "query-groups", label: "Query Groups", icon: GroupsOutlined },
  { id: "product-matches", label: "Product Matches", icon: Inventory2Outlined },
  { id: "vocabulary-gaps", label: "Vocabulary Gaps", icon: SpellcheckOutlined },
  { id: "recommendations", label: "Recommendations", icon: TipsAndUpdatesOutlined },
  { id: "fix-simulator", label: "Fix Simulator", icon: CompareArrowsOutlined }
];

const titles = {
  overview: ["Search intelligence", "A practical view of what customers ask for and where the catalog falls short."],
  "zero-results": ["Zero-result searches", "Unanswered demand, ranked by search volume."],
  "query-groups": ["Query groups", "Related searches grouped by weighted overlap in normalized terms."],
  "product-matches": ["Product matches", "Catalog ranking with field weights and matched-term evidence."],
  "vocabulary-gaps": ["Vocabulary gaps", "Unmatched customer language compared with candidate product metadata."],
  recommendations: ["Recommendations", "Reviewable search and catalog actions derived from current data."],
  "fix-simulator": ["Fix simulator", "Test a temporary query expansion without changing source data."]
};

function readSearches() {
  try {
    const stored = JSON.parse(localStorage.getItem("footwear-searches-v1"));
    return Array.isArray(stored) ? mergeSearches(initialSearches, stored) : initialSearches;
  } catch {
    return initialSearches;
  }
}

function Stat({ label, value, note, accent = "#d85b3f" }) {
  return <Paper className="stat-panel" elevation={0} style={{ "--stat-accent": accent }}>
    <Typography className="stat-label">{label}</Typography>
    <Typography className="stat-value">{value}</Typography>
    <Typography className="stat-note">{note}</Typography>
  </Paper>;
}

function SectionHeading({ title, detail, action }) {
  return <Box className="section-heading"><Box><Typography variant="h2">{title}</Typography>{detail && <Typography className="muted">{detail}</Typography>}</Box>{action}</Box>;
}

function EmptyState({ children }) {
  return <Paper className="empty-state" elevation={0}><Typography>{children}</Typography></Paper>;
}

function ScoreBar({ value }) {
  return <Box className="score-cell"><LinearProgress variant="determinate" value={value} /><Typography>{value}</Typography></Box>;
}

function Overview({ searches, groups, recommendations, onNavigate }) {
  const total = searches.reduce((sum, item) => sum + item.searchCount, 0);
  const zeroes = searches.filter((item) => item.resultCount === 0);
  const zeroVolume = zeroes.reduce((sum, item) => sum + item.searchCount, 0);
  const top = [...zeroes].sort((a, b) => b.searchCount - a.searchCount).slice(0, 5);
  const max = top[0]?.searchCount ?? 1;
  return <>
    <div className="stats-grid">
      <Stat label="Searches tracked" value={total.toLocaleString()} note={`${searches.length} distinct normalized queries`} accent="#d85b3f" />
      <Stat label="Zero-result volume" value={zeroVolume.toLocaleString()} note={`${zeroes.length} queries without results`} accent="#bd742c" />
      <Stat label="Related query groups" value={groups.length} note="Weighted Jaccard clusters" accent="#4b7867" />
      <Stat label="Actions to review" value={recommendations.length} note="Generated from current searches" accent="#526d88" />
    </div>
    <div className="overview-grid">
      <Paper className="content-panel demand-panel" elevation={0}>
        <SectionHeading title="Unanswered demand" detail="Top zero-result queries by search count" action={<Button onClick={() => onNavigate("zero-results")} size="small">View all</Button>} />
        {top.map((item, index) => <Box className="demand-row" key={item.id}>
          <Typography className="rank-number">0{index + 1}</Typography>
          <Box className="demand-main"><Box className="demand-label"><Typography>{item.query}</Typography><Typography className="demand-count">{item.searchCount}</Typography></Box><LinearProgress variant="determinate" value={item.searchCount / max * 100} /></Box>
        </Box>)}
      </Paper>
      <Paper className="content-panel insight-panel" elevation={0}>
        <Typography className="eyebrow">Reading the score</Typography>
        <Typography variant="h2">A match you can audit.</Typography>
        <Typography className="muted">Candidate scores are weighted coverage of normalized query terms in five product fields. Every result lists the matching terms and each field’s contribution.</Typography>
        <Box className="weight-list">{Object.entries(SCORE_WEIGHTS).map(([field, weight]) => <Box key={field}><span>{field}</span><b>{Math.round(weight * 100)}%</b></Box>)}</Box>
        <Button className="text-action" onClick={() => onNavigate("product-matches")}>Inspect product matches <span aria-hidden="true">↗</span></Button>
      </Paper>
    </div>
    <Box className="catalog-ribbon"><Box><Typography className="eyebrow">Synthetic footwear catalog</Typography><Typography>{products.length} products · {searches.length} query phrases · local browser storage</Typography></Box><Button onClick={() => onNavigate("recommendations")}>Open recommendations</Button></Box>
  </>;
}

function ZeroResults({ searches, onSelect }) {
  const rows = [...searches].filter((item) => item.resultCount === 0).sort((a, b) => b.searchCount - a.searchCount);
  return <Paper className="content-panel table-panel" elevation={0}>
    <SectionHeading title={`${rows.length} queries need attention`} detail="Click a query to inspect its product matches." />
    <Table size="small"><TableHead><TableRow><TableCell>Search phrase</TableCell><TableCell>Searches</TableCell><TableCell>Result count</TableCell><TableCell>Normalized query</TableCell></TableRow></TableHead>
      <TableBody>{rows.map((row) => <TableRow hover key={row.id} onClick={() => onSelect(row.query)} className="click-row">
        <TableCell className="strong-cell">{row.query}</TableCell><TableCell>{row.searchCount}</TableCell><TableCell><Chip size="small" label="0 results" className="zero-chip" /></TableCell><TableCell className="muted">{normalizeQuery(row.query, vocabulary).normalized}</TableCell>
      </TableRow>)}</TableBody>
    </Table>
  </Paper>;
}

function QueryGroups({ groups }) {
  return <div className="group-list">{groups.map((group) => <Paper key={group.representative} className="group-panel" elevation={0}>
    <Box className="group-top"><Box><Typography className="eyebrow">Representative query</Typography><Typography variant="h3">{group.representative}</Typography></Box><Box className="group-count"><b>{group.totalSearches}</b><span>searches</span></Box></Box>
    <Divider />
    <Box className="group-meta"><span>{group.members.length} distinct phrases</span><span>{group.zeroResultSearches} zero-result searches</span><span>{Math.round(group.averageSimilarity * 100)}% average overlap</span></Box>
    <Box className="member-list">{group.members.map((member) => <Box key={member.id} className="member-row"><Typography>{member.query}</Typography><Typography>{member.searchCount}<small> searches</small></Typography><Chip size="small" label={member.resultCount === 0 ? "No results" : `${member.resultCount} results`} /></Box>)}</Box>
  </Paper>)}</div>;
}

function ProductMatches({ query, setQuery, results, onSubmit }) {
  return <>
    <Paper className="content-panel query-panel" elevation={0}>
      <TextField fullWidth label="Search query" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onSubmit()} placeholder="Try “adiddas running shoes”" />
      <Button variant="contained" onClick={onSubmit} startIcon={<SearchOutlined />}>Analyze query</Button>
    </Paper>
    <Paper className="content-panel table-panel" elevation={0}>
      <SectionHeading title={`${results.length} ranked products`} detail="Weighted score from 0 to 100. Scores explain overlap, not purchase likelihood." />
      {!results.length ? <EmptyState>Enter a query to see matching catalog products.</EmptyState> : results.map((result) => <Box className="match-card" key={result.product.id}>
        <Box className="match-product"><Typography className="eyebrow">{result.product.brand} · {result.product.category}</Typography><Typography variant="h3">{result.product.title}</Typography><Typography className="muted">{result.product.color} · ${result.product.price.toLocaleString()}</Typography></Box>
        <Box className="match-score"><b>{result.score}</b><span>weighted score</span><ScoreBar value={result.score} /></Box>
        <Box className="match-evidence"><Typography className="eyebrow">Why it matched</Typography>{result.explanation.length ? result.explanation.map((part) => <Chip key={part.field} size="small" label={`${part.field}: ${part.terms.join(", ")} · ${Math.round(part.contribution * 100)} pts`} />) : <Typography className="muted">No field evidence.</Typography>}{result.corrections.map((item) => <Chip key={item.from} size="small" color="warning" label={`Spelling: ${item.from} → ${item.to}`} />)}</Box>
      </Box>)}
    </Paper>
  </>;
}

function VocabularyGaps({ searches, sourceSearches }) {
  const gaps = collectVocabularyGaps(searches, products, vocabulary, sourceSearches);
  return <Paper className="content-panel table-panel" elevation={0}>
    <SectionHeading title={`${gaps.length} candidate gaps`} detail="A rule-based comparison of query terms and recovered product metadata." />
    {gaps.length ? <Table size="small"><TableHead><TableRow><TableCell>Query</TableCell><TableCell>Unrepresented term</TableCell><TableCell>Candidate product</TableCell><TableCell>Searches</TableCell><TableCell>Weighted score</TableCell></TableRow></TableHead><TableBody>{gaps.map((gap, index) => <TableRow key={`${gap.query}-${gap.term}-${index}`}><TableCell>{gap.query}</TableCell><TableCell><Chip size="small" label={gap.term} className="term-chip" /></TableCell><TableCell>{gap.product.title}</TableCell><TableCell>{gap.searchCount}</TableCell><TableCell>{gap.score}</TableCell></TableRow>)}</TableBody></Table> : <EmptyState>No zero-result query currently has both a plausible catalog candidate and an unsupported term.</EmptyState>}
    <Alert severity="info" className="notice">A vocabulary relationship is a review suggestion, not a proven synonym.</Alert>
  </Paper>;
}

function Recommendations({ recommendations }) {
  return <div className="recommendation-list">{recommendations.map((item, index) => <Paper className="recommendation-row" elevation={0} key={`${item.query}-${item.type}-${index}`}>
    <Box className="recommendation-priority"><span>{String(index + 1).padStart(2, "0")}</span><b>{item.searchCount}</b><small>searches</small></Box>
    <Box className="recommendation-copy"><Box className="recommendation-tags"><Chip size="small" label={item.type.replaceAll("_", " ")} /><Chip size="small" variant="outlined" label={item.query} /></Box><Typography>{item.detail}</Typography></Box>
    <Box className="recommendation-score"><b>{item.score}</b><small>top score</small></Box>
  </Paper>)}</div>;
}

function FixSimulator({ query, setQuery, mapping, setMapping, result, onSimulate }) {
  return <>
    <Paper className="content-panel simulator-form" elevation={0}>
      <Box><Typography className="eyebrow">Temporary rewrite</Typography><Typography variant="h3">Try a search expansion</Typography><Typography className="muted">The mapping is applied only in this simulator session.</Typography></Box>
      <TextField label="Original query" value={query} onChange={(event) => setQuery(event.target.value)} />
      <TextField label="Add this term" value={mapping} onChange={(event) => setMapping(event.target.value)} placeholder="For example: party" />
      <Button variant="contained" onClick={onSimulate} startIcon={<CompareArrowsOutlined />}>Run simulation</Button>
    </Paper>
    <Alert severity="warning" className="notice">Simulation does not change source JSON, saved searches, or production data.</Alert>
    {result && <div className="simulation-grid">
      <Paper className="simulation-side" elevation={0}><Typography className="eyebrow">Before · lexical query</Typography><Typography variant="h3">{query || "No query"}</Typography><Typography className="simulation-empty">{result.before.length ? `${result.before.length} candidates` : "0 results"}</Typography></Paper>
      <Paper className="simulation-side simulation-after" elevation={0}><Typography className="eyebrow">After · temporary rewrite</Typography><Typography variant="h3">{result.rewrittenQuery}</Typography><Typography className="simulation-empty">{result.after.length} candidates</Typography>{result.after.slice(0, 3).map((item) => <Box className="sim-result" key={item.product.id}><span>{item.product.title}</span><b>{item.score}</b></Box>)}</Paper>
    </div>}
  </>;
}

export default function App() {
  const [page, setPage] = useState("overview");
  const [searches, setSearches] = useState(readSearches);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [mapping, setMapping] = useState("");
  const [simulation, setSimulation] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [notice, setNotice] = useState("");
  const theme = useMemo(() => createTheme({
    palette: { mode: darkMode ? "dark" : "light", primary: { main: "#286552" }, secondary: { main: "#d85b3f" }, background: { default: darkMode ? "#161c19" : "#f4f4ef", paper: darkMode ? "#202925" : "#fff" } },
    typography: { fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif', h2: { fontFamily: 'Georgia, "Times New Roman", serif', fontSize: "1.7rem", fontWeight: 500 }, h3: { fontFamily: 'Georgia, "Times New Roman", serif', fontSize: "1.3rem", fontWeight: 500 }, button: { textTransform: "none", fontWeight: 700 } },
    shape: { borderRadius: 4 }, components: { MuiButton: { styleOverrides: { root: { borderRadius: 4, minHeight: 40 } } }, MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } } }
  }), [darkMode]);

  useEffect(() => { localStorage.setItem("footwear-searches-v1", JSON.stringify(searches)); }, [searches]);
  const groups = useMemo(() => groupQueries(searches, vocabulary), [searches]);
  const recommendations = useMemo(() => createRecommendations(searches, products, vocabulary), [searches]);
  const results = useMemo(() => activeQuery ? rankProducts(activeQuery, products, vocabulary) : [], [activeQuery]);

  function analyzeQuery() {
    const original = query.trim().replace(/\s+/g, " ");
    if (!original) return;
    const ranked = rankProducts(original, products, vocabulary).filter((item) => item.score >= 12);
    const resultCount = ranked.length;
    setSearches((current) => recordSearch(current, original, resultCount));
    setActiveQuery(original);
    setNotice(resultCount ? `Found ${resultCount} catalog matches for “${original}”.` : `No catalog matches for “${original}”. It was added to zero-result searches.`);
    setPage("product-matches");
  }

  function chooseQuery(value) {
    setQuery(value);
    setActiveQuery(value);
    setPage("product-matches");
  }

  const title = titles[page];
  const content = {
    overview: <Overview searches={searches} groups={groups} recommendations={recommendations} onNavigate={setPage} />,
    "zero-results": <ZeroResults searches={searches} onSelect={chooseQuery} />,
    "query-groups": <QueryGroups groups={groups} />,
    "product-matches": <ProductMatches query={query} setQuery={setQuery} results={results} onSubmit={analyzeQuery} />,
    "vocabulary-gaps": <VocabularyGaps searches={searches} sourceSearches={initialSearches} />,
    recommendations: <Recommendations recommendations={recommendations} />,
    "fix-simulator": <FixSimulator query={query} setQuery={setQuery} mapping={mapping} setMapping={setMapping} result={simulation} onSimulate={() => setSimulation(simulateFix(query, mapping, products, vocabulary))} />
  }[page];

  return <ThemeProvider theme={theme}><CssBaseline />
    <Box className="app-shell">
      <Drawer variant="permanent" className="sidebar" sx={{ width: drawerWidth, flexShrink: 0, "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" } }}>
        <Box className="brand-lockup"><Box className="brand-mark">S<span>i</span></Box><Box><Typography className="brand-name">Sole / Search</Typography><Typography className="brand-subtitle">MERCHANDISING INTELLIGENCE</Typography></Box></Box>
        <Typography className="nav-caption">WORKSPACE</Typography>
        <Box component="nav" aria-label="Main navigation" className="nav-list">{navItems.map(({ id, label, icon: Icon }) => <Button key={id} onClick={() => { setPage(id); setNotice(""); }} className={`nav-item ${page === id ? "selected" : ""}`} startIcon={<Icon />}>{label}{id === "zero-results" && <span className="nav-count">{searches.filter((item) => item.resultCount === 0).length}</span>}</Button>)}</Box>
        <Box className="sidebar-bottom"><Divider /><Typography className="nav-caption">DATASET</Typography><Typography className="dataset-name">Synthetic footwear</Typography><Typography className="dataset-detail">{products.length} products · {searches.length} queries</Typography><Typography className="dataset-note">All calculations run in this browser.</Typography></Box>
      </Drawer>
      <Box className="main-column">
        <AppBar position="sticky" elevation={0} className="topbar"><Toolbar className="topbar-inner">
          <Box className="mobile-brand"><span className="brand-mark">S<span>i</span></span></Box>
          <TextField className="global-search" size="small" aria-label="Analyze a search query" placeholder="Analyze a customer search…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && analyzeQuery()} InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined fontSize="small" /></InputAdornment>, endAdornment: <InputAdornment position="end"><kbd>↵</kbd></InputAdornment> }} />
          <Tooltip title={darkMode ? "Switch to light theme" : "Switch to dark theme"}><IconButton aria-label="Toggle color theme" onClick={() => setDarkMode((value) => !value)}>{darkMode ? <LightModeOutlined /> : <DarkModeOutlined />}</IconButton></Tooltip>
          <Button className="top-search-button" variant="contained" startIcon={<AddOutlined />} onClick={analyzeQuery}>Analyze</Button>
        </Toolbar></AppBar>
        <Box component="main" className="page-content">
          <Box className="page-title"><Box><Typography className="eyebrow">FOOTWEAR · SEARCH QUALITY</Typography><Typography variant="h1">{title[0]}</Typography><Typography className="page-description">{title[1]}</Typography></Box><div className="page-date">LIVE DATA <span /></div></Box>
          {notice && <Alert onClose={() => setNotice("")} severity="info" className="notice">{notice}</Alert>}
          {content}
          <Box component="footer" className="page-footer"><span>SEARCH INTELLIGENCE / FOOTWEAR</span><span>Rule-based · explainable · synthetic dataset</span></Box>
        </Box>
      </Box>
      <Box component="nav" aria-label="Mobile navigation" className="mobile-nav">{navItems.map(({ id, label, icon: Icon }) => <Tooltip key={id} title={label}><IconButton aria-label={label} onClick={() => setPage(id)} className={page === id ? "mobile-selected" : ""}><Icon /></IconButton></Tooltip>)}</Box>
    </Box>
  </ThemeProvider>;
}