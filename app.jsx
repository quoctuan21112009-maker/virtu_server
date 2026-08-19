import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  LogOut, QrCode, Copy, Plus, RefreshCw, Users, Lock, ShieldAlert,
  ShieldCheck, GraduationCap, UserCog, Video, ImageIcon, X, ChevronRight,
  Minimize2, Clock3, WifiOff, Play, Check, LayoutGrid, ListFilter, Radio,
  Sparkles, School, ScanEye, ArrowLeft, UserPlus2, ClipboardPaste, Trash2,
  KeyRound, Server, Eye, EyeOff, Loader2, AlertTriangle, LogIn, UserPlus,
  Link2, Inbox, AlertCircle
} from "lucide-react";

/* ============================================================
   VIRTU — Web Console (Nâng cấp)
   - Thêm Error Boundary
   - Thêm React.memo cho components
   - Tối ưu performance
   - Xử lý CORS với Flask backend
   ============================================================ */

const LOGO_URI = "data:image/webp;base64,UklGRqAqAABXRUJQVlA4WAoAAAAQAAAAiwAAdgAAQUxQSGoRAAABsIftk2KpVVX1WV90IQTXBJclgl2cuMKFOB53d3f3BI0rbhHcbrCLxnBbSBZ322VPdz3PdFefM3M28mdESLRtJagtcj88VgaEiHbfD0DKDyRFAJDTrAECgCKEv+yBZM9B5S5Pz962btQNLTMBgBT+FU+RY3us23vob0XsHAdmPtmmrBApaltiaei3bLuHx247ycxGG60NMx9c+k7/ejFXsiiVSH0L1v7vK4v3c3C49zq3atvT1sn3di5vJYvKawmgQbOUDREEgPRWt0xYb9xzoiVBw+Elw3vVjMpLCCo/v/lRiP4Cd6hC1Yten7ovQb+coME44ui1n93RJD18t4TQfgnzraAirjnncvLvGLa22Bo+iZakut0x5ZGLTgnXLYG6ey/Hda/o/8GGVz67cE+S/RqTjCg6biU5/uuIfi1ibkMSpxRU/5a5hPfnR0ZIRACIHUf9yUn065HE7TzZbgu/u7tNXlJeQnD2Ums+XpAFGI1rogg8mT8m6ZnGOGruXLRBhzPQ4WXv964mfB099XMLOM7Br08BIwte3Z+6EpDgrpPxpDyCmUtWf3pDmwoNej3+/XbRrUluEBWvHzm4YcwdKC467wxg6fmQV6JoqXXZK0sO84FzQEH5ZayTee/HVn/Ut5awZkaLu8esPeBzk2SkLJj2zCUNM8TZeqscsDFXhyEkR6QKbR+YtM4xOC8siwr6x41JpNKe6a+cL8OXG2hitbo9MWrd8WQb3BhTOOP2ShZVZrnQvL5mclf63ly13m8sOiLHqo7fAgpz5rL2vWqz5st+Z+S4giZyprT6F7+9osiR2STZ7ap6oKDyVNZinN8U6kyFNjcOW1/kH5m8pgbGoFeR1m6/+5a+0aemUBuT86mqFz43r5CTmhA4ztu6AGHmlxwXcnycickSQus3lu5OHLw0PwyEsW8coXdPfbhdxaQjp9cuZfNv+HxLSTIa7O5pO3+N48bFrCpJc4L6Pyc1BrVZVxticObGvQvev7JFjhOjQg5/dBrUaT1fmrorgQK8tzcoBbcYVzHN65oAQdK83AzjjxnGCNnfsKLmt5X9RpjP5OT3G7rwoEeL+O1BHbrvZ+F0u7uHCfUEV530vknDbFwB9rcF9HpmpFMFQMULf2ft4rkYxeD0daxdHLoSwqiBWHaOP34dOywsyeMz0X8u0lMKamywZDSPSIMY1J4nez95T8gJkOCyY/Ki4kWvnnfOeqdqTEl/wJRlwfiqI3ucvyzrgSPHe249DEv/0ZVR8y/1AaBvkTGuFDWBUgRout2S5hlVIA0aLBTQ/H1ZwNAin3fU0drwjnxMo6wfxDX8TIoICT5gbeX+tUmA2os5LrD6tPCKIKrR0qWHWKc/55DLzOZGgKnh3Q4YY6eYMyEGVed6sPc/QFEI3fGw8M097UFhbJQ0yZspIcSs6axZ85aOAarMETBcfC2oaMQeLk9/Raig8wHjmmRXe6BU8MFxw4Z39oAYpY+S0Po+oKicfIdx49DxbgGDD6VJRqUjRo96a22gPno1xBS8yHEjeh8RI4woVMM7UusJGQFr+Ce77Ngl0TPCQAXNJ+8GFYNBcS2njwVVgDAqI9bfItzhxAAggvu16GReXtSMoOsem9u8CBSDCw+wxNqGFq0qh3d8G9fhKTlO1tUImsrNE/OWuT1ih
