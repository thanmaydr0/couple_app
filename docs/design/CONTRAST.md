# Contrast verification

WCAG sRGB relative luminance, (L1 + 0.05)/(L2 + 0.05). All text, including small timestamps, must reach 4.5:1. Opaque text only; no opacity reduction.

Both Auto resolutions are covered: day duplicates Rose; night resolves Midnight. Gradients are sRGB with 1,001 samples including both endpoints; this is numerical sampling, not a mathematical proof for every real number. Overlay text must sit on an opaque theme surface.

| Theme | Pair | Minimum ratio | Result |
|---|---|---:|---|
| Auto | textPrimary / bg | 14.143:1 | PASS |
| Auto | textPrimary / bgElevated | 15.166:1 | PASS |
| Auto | textPrimary / surface | 12.956:1 | PASS |
| Auto | textPrimary / surfaceAlt | 11.526:1 | PASS |
| Auto | textSecondary / bg | 8.135:1 | PASS |
| Auto | textSecondary / bgElevated | 8.723:1 | PASS |
| Auto | textSecondary / surface | 7.452:1 | PASS |
| Auto | textSecondary / surfaceAlt | 6.629:1 | PASS |
| Auto | textMuted / bg | 6.241:1 | PASS |
| Auto | textMuted / bgElevated | 6.692:1 | PASS |
| Auto | textMuted / surface | 5.717:1 | PASS |
| Auto | textMuted / surfaceAlt | 5.086:1 | PASS |
| Auto | primary / bg | 7.835:1 | PASS |
| Auto | primary / bgElevated | 8.402:1 | PASS |
| Auto | primary / surface | 7.178:1 | PASS |
| Auto | primary / surfaceAlt | 6.385:1 | PASS |
| Auto | accent / bg | 6.553:1 | PASS |
| Auto | accent / bgElevated | 7.027:1 | PASS |
| Auto | accent / surface | 6.003:1 | PASS |
| Auto | accent / surfaceAlt | 5.340:1 | PASS |
| Auto | success / bg | 7.086:1 | PASS |
| Auto | success / bgElevated | 7.599:1 | PASS |
| Auto | success / surface | 6.491:1 | PASS |
| Auto | success / surfaceAlt | 5.774:1 | PASS |
| Auto | warning / bg | 6.669:1 | PASS |
| Auto | warning / bgElevated | 7.152:1 | PASS |
| Auto | warning / surface | 6.110:1 | PASS |
| Auto | warning / surfaceAlt | 5.435:1 | PASS |
| Auto | danger / bg | 7.308:1 | PASS |
| Auto | danger / bgElevated | 7.837:1 | PASS |
| Auto | danger / surface | 6.695:1 | PASS |
| Auto | danger / surfaceAlt | 5.955:1 | PASS |
| Auto | primaryContrast / primary | 8.402:1 | PASS |
| Auto | bubbleTheirsText / bubbleTheirs | 11.526:1 | PASS |
| Auto | bubbleMineText / bubbleMine gradient (1001 samples) | 8.402:1 | PASS |
| Auto | tickSent / bubbleMine gradient (1001 samples) | 5.550:1 | PASS |
| Auto | tickSeen / bubbleMine gradient (1001 samples) | 8.402:1 | PASS |
| Midnight | textPrimary / bg | 17.370:1 | PASS |
| Midnight | textPrimary / bgElevated | 15.992:1 | PASS |
| Midnight | textPrimary / surface | 14.661:1 | PASS |
| Midnight | textPrimary / surfaceAlt | 12.980:1 | PASS |
| Midnight | textSecondary / bg | 11.889:1 | PASS |
| Midnight | textSecondary / bgElevated | 10.946:1 | PASS |
| Midnight | textSecondary / surface | 10.035:1 | PASS |
| Midnight | textSecondary / surfaceAlt | 8.884:1 | PASS |
| Midnight | textMuted / bg | 9.004:1 | PASS |
| Midnight | textMuted / bgElevated | 8.290:1 | PASS |
| Midnight | textMuted / surface | 7.600:1 | PASS |
| Midnight | textMuted / surfaceAlt | 6.728:1 | PASS |
| Midnight | primary / bg | 9.726:1 | PASS |
| Midnight | primary / bgElevated | 8.955:1 | PASS |
| Midnight | primary / surface | 8.209:1 | PASS |
| Midnight | primary / surfaceAlt | 7.268:1 | PASS |
| Midnight | accent / bg | 9.954:1 | PASS |
| Midnight | accent / bgElevated | 9.164:1 | PASS |
| Midnight | accent / surface | 8.402:1 | PASS |
| Midnight | accent / surfaceAlt | 7.438:1 | PASS |
| Midnight | success / bg | 12.219:1 | PASS |
| Midnight | success / bgElevated | 11.250:1 | PASS |
| Midnight | success / surface | 10.314:1 | PASS |
| Midnight | success / surfaceAlt | 9.131:1 | PASS |
| Midnight | warning / bg | 12.436:1 | PASS |
| Midnight | warning / bgElevated | 11.450:1 | PASS |
| Midnight | warning / surface | 10.497:1 | PASS |
| Midnight | warning / surfaceAlt | 9.293:1 | PASS |
| Midnight | danger / bg | 10.959:1 | PASS |
| Midnight | danger / bgElevated | 10.090:1 | PASS |
| Midnight | danger / surface | 9.250:1 | PASS |
| Midnight | danger / surfaceAlt | 8.189:1 | PASS |
| Midnight | primaryContrast / primary | 9.125:1 | PASS |
| Midnight | bubbleTheirsText / bubbleTheirs | 12.980:1 | PASS |
| Midnight | bubbleMineText / bubbleMine gradient (1001 samples) | 8.208:1 | PASS |
| Midnight | tickSent / bubbleMine gradient (1001 samples) | 4.798:1 | PASS |
| Midnight | tickSeen / bubbleMine gradient (1001 samples) | 6.778:1 | PASS |
| Noir | textPrimary / bg | 21.000:1 | PASS |
| Noir | textPrimary / bgElevated | 19.562:1 | PASS |
| Noir | textPrimary / surface | 18.261:1 | PASS |
| Noir | textPrimary / surfaceAlt | 15.910:1 | PASS |
| Noir | textSecondary / bg | 14.167:1 | PASS |
| Noir | textSecondary / bgElevated | 13.197:1 | PASS |
| Noir | textSecondary / surface | 12.320:1 | PASS |
| Noir | textSecondary / surfaceAlt | 10.734:1 | PASS |
| Noir | textMuted / bg | 10.242:1 | PASS |
| Noir | textMuted / bgElevated | 9.540:1 | PASS |
| Noir | textMuted / surface | 8.906:1 | PASS |
| Noir | textMuted / surfaceAlt | 7.759:1 | PASS |
| Noir | primary / bg | 11.582:1 | PASS |
| Noir | primary / bgElevated | 10.789:1 | PASS |
| Noir | primary / surface | 10.072:1 | PASS |
| Noir | primary / surfaceAlt | 8.775:1 | PASS |
| Noir | accent / bg | 13.553:1 | PASS |
| Noir | accent / bgElevated | 12.625:1 | PASS |
| Noir | accent / surface | 11.785:1 | PASS |
| Noir | accent / surfaceAlt | 10.268:1 | PASS |
| Noir | success / bg | 13.964:1 | PASS |
| Noir | success / bgElevated | 13.008:1 | PASS |
| Noir | success / surface | 12.143:1 | PASS |
| Noir | success / surfaceAlt | 10.580:1 | PASS |
| Noir | warning / bg | 14.212:1 | PASS |
| Noir | warning / bgElevated | 13.239:1 | PASS |
| Noir | warning / surface | 12.358:1 | PASS |
| Noir | warning / surfaceAlt | 10.767:1 | PASS |
| Noir | danger / bg | 12.524:1 | PASS |
| Noir | danger / bgElevated | 11.666:1 | PASS |
| Noir | danger / surface | 10.891:1 | PASS |
| Noir | danger / surfaceAlt | 9.488:1 | PASS |
| Noir | primaryContrast / primary | 10.109:1 | PASS |
| Noir | bubbleTheirsText / bubbleTheirs | 15.910:1 | PASS |
| Noir | bubbleMineText / bubbleMine gradient (1001 samples) | 8.673:1 | PASS |
| Noir | tickSent / bubbleMine gradient (1001 samples) | 4.769:1 | PASS |
| Noir | tickSeen / bubbleMine gradient (1001 samples) | 6.737:1 | PASS |
| Rose | textPrimary / bg | 14.143:1 | PASS |
| Rose | textPrimary / bgElevated | 15.166:1 | PASS |
| Rose | textPrimary / surface | 12.956:1 | PASS |
| Rose | textPrimary / surfaceAlt | 11.526:1 | PASS |
| Rose | textSecondary / bg | 8.135:1 | PASS |
| Rose | textSecondary / bgElevated | 8.723:1 | PASS |
| Rose | textSecondary / surface | 7.452:1 | PASS |
| Rose | textSecondary / surfaceAlt | 6.629:1 | PASS |
| Rose | textMuted / bg | 6.241:1 | PASS |
| Rose | textMuted / bgElevated | 6.692:1 | PASS |
| Rose | textMuted / surface | 5.717:1 | PASS |
| Rose | textMuted / surfaceAlt | 5.086:1 | PASS |
| Rose | primary / bg | 7.835:1 | PASS |
| Rose | primary / bgElevated | 8.402:1 | PASS |
| Rose | primary / surface | 7.178:1 | PASS |
| Rose | primary / surfaceAlt | 6.385:1 | PASS |
| Rose | accent / bg | 6.553:1 | PASS |
| Rose | accent / bgElevated | 7.027:1 | PASS |
| Rose | accent / surface | 6.003:1 | PASS |
| Rose | accent / surfaceAlt | 5.340:1 | PASS |
| Rose | success / bg | 7.086:1 | PASS |
| Rose | success / bgElevated | 7.599:1 | PASS |
| Rose | success / surface | 6.491:1 | PASS |
| Rose | success / surfaceAlt | 5.774:1 | PASS |
| Rose | warning / bg | 6.669:1 | PASS |
| Rose | warning / bgElevated | 7.152:1 | PASS |
| Rose | warning / surface | 6.110:1 | PASS |
| Rose | warning / surfaceAlt | 5.435:1 | PASS |
| Rose | danger / bg | 7.308:1 | PASS |
| Rose | danger / bgElevated | 7.837:1 | PASS |
| Rose | danger / surface | 6.695:1 | PASS |
| Rose | danger / surfaceAlt | 5.955:1 | PASS |
| Rose | primaryContrast / primary | 8.402:1 | PASS |
| Rose | bubbleTheirsText / bubbleTheirs | 11.526:1 | PASS |
| Rose | bubbleMineText / bubbleMine gradient (1001 samples) | 8.402:1 | PASS |
| Rose | tickSent / bubbleMine gradient (1001 samples) | 5.550:1 | PASS |
| Rose | tickSeen / bubbleMine gradient (1001 samples) | 8.402:1 | PASS |
| Sunset | textPrimary / bg | 16.713:1 | PASS |
| Sunset | textPrimary / bgElevated | 15.079:1 | PASS |
| Sunset | textPrimary / surface | 13.654:1 | PASS |
| Sunset | textPrimary / surfaceAlt | 11.819:1 | PASS |
| Sunset | textSecondary / bg | 11.587:1 | PASS |
| Sunset | textSecondary / bgElevated | 10.454:1 | PASS |
| Sunset | textSecondary / surface | 9.467:1 | PASS |
| Sunset | textSecondary / surfaceAlt | 8.195:1 | PASS |
| Sunset | textMuted / bg | 8.819:1 | PASS |
| Sunset | textMuted / bgElevated | 7.957:1 | PASS |
| Sunset | textMuted / surface | 7.205:1 | PASS |
| Sunset | textMuted / surfaceAlt | 6.237:1 | PASS |
| Sunset | primary / bg | 10.281:1 | PASS |
| Sunset | primary / bgElevated | 9.276:1 | PASS |
| Sunset | primary / surface | 8.400:1 | PASS |
| Sunset | primary / surfaceAlt | 7.271:1 | PASS |
| Sunset | accent / bg | 11.731:1 | PASS |
| Sunset | accent / bgElevated | 10.584:1 | PASS |
| Sunset | accent / surface | 9.584:1 | PASS |
| Sunset | accent / surfaceAlt | 8.296:1 | PASS |
| Sunset | success / bg | 11.858:1 | PASS |
| Sunset | success / bgElevated | 10.699:1 | PASS |
| Sunset | success / surface | 9.688:1 | PASS |
| Sunset | success / surfaceAlt | 8.386:1 | PASS |
| Sunset | warning / bg | 12.069:1 | PASS |
| Sunset | warning / bgElevated | 10.889:1 | PASS |
| Sunset | warning / surface | 9.860:1 | PASS |
| Sunset | warning / surfaceAlt | 8.535:1 | PASS |
| Sunset | danger / bg | 10.635:1 | PASS |
| Sunset | danger / bgElevated | 9.595:1 | PASS |
| Sunset | danger / surface | 8.689:1 | PASS |
| Sunset | danger / surfaceAlt | 7.521:1 | PASS |
| Sunset | primaryContrast / primary | 9.571:1 | PASS |
| Sunset | bubbleTheirsText / bubbleTheirs | 11.819:1 | PASS |
| Sunset | bubbleMineText / bubbleMine gradient (1001 samples) | 8.131:1 | PASS |
| Sunset | tickSent / bubbleMine gradient (1001 samples) | 4.936:1 | PASS |
| Sunset | tickSeen / bubbleMine gradient (1001 samples) | 6.973:1 | PASS |
| Ocean | textPrimary / bg | 16.518:1 | PASS |
| Ocean | textPrimary / bgElevated | 14.425:1 | PASS |
| Ocean | textPrimary / surface | 12.639:1 | PASS |
| Ocean | textPrimary / surfaceAlt | 10.802:1 | PASS |
| Ocean | textSecondary / bg | 12.117:1 | PASS |
| Ocean | textSecondary / bgElevated | 10.582:1 | PASS |
| Ocean | textSecondary / surface | 9.271:1 | PASS |
| Ocean | textSecondary / surfaceAlt | 7.924:1 | PASS |
| Ocean | textMuted / bg | 9.603:1 | PASS |
| Ocean | textMuted / bgElevated | 8.386:1 | PASS |
| Ocean | textMuted / surface | 7.348:1 | PASS |
| Ocean | textMuted / surfaceAlt | 6.280:1 | PASS |
| Ocean | primary / bg | 11.159:1 | PASS |
| Ocean | primary / bgElevated | 9.745:1 | PASS |
| Ocean | primary / surface | 8.538:1 | PASS |
| Ocean | primary / surfaceAlt | 7.297:1 | PASS |
| Ocean | accent / bg | 10.248:1 | PASS |
| Ocean | accent / bgElevated | 8.949:1 | PASS |
| Ocean | accent / surface | 7.841:1 | PASS |
| Ocean | accent / surfaceAlt | 6.701:1 | PASS |
| Ocean | success / bg | 11.455:1 | PASS |
| Ocean | success / bgElevated | 10.004:1 | PASS |
| Ocean | success / surface | 8.765:1 | PASS |
| Ocean | success / surfaceAlt | 7.491:1 | PASS |
| Ocean | warning / bg | 11.659:1 | PASS |
| Ocean | warning / bgElevated | 10.181:1 | PASS |
| Ocean | warning / surface | 8.920:1 | PASS |
| Ocean | warning / surfaceAlt | 7.624:1 | PASS |
| Ocean | danger / bg | 10.274:1 | PASS |
| Ocean | danger / bgElevated | 8.972:1 | PASS |
| Ocean | danger / surface | 7.861:1 | PASS |
| Ocean | danger / surfaceAlt | 6.719:1 | PASS |
| Ocean | primaryContrast / primary | 9.709:1 | PASS |
| Ocean | bubbleTheirsText / bubbleTheirs | 10.802:1 | PASS |
| Ocean | bubbleMineText / bubbleMine gradient (1001 samples) | 8.890:1 | PASS |
| Ocean | tickSent / bubbleMine gradient (1001 samples) | 5.978:1 | PASS |
| Ocean | tickSeen / bubbleMine gradient (1001 samples) | 8.445:1 | PASS |
| Lavender | textPrimary / bg | 13.585:1 | PASS |
| Lavender | textPrimary / bgElevated | 14.724:1 | PASS |
| Lavender | textPrimary / surface | 12.232:1 | PASS |
| Lavender | textPrimary / surfaceAlt | 11.026:1 | PASS |
| Lavender | textSecondary / bg | 7.637:1 | PASS |
| Lavender | textSecondary / bgElevated | 8.277:1 | PASS |
| Lavender | textSecondary / surface | 6.877:1 | PASS |
| Lavender | textSecondary / surfaceAlt | 6.198:1 | PASS |
| Lavender | textMuted / bg | 5.774:1 | PASS |
| Lavender | textMuted / bgElevated | 6.259:1 | PASS |
| Lavender | textMuted / surface | 5.199:1 | PASS |
| Lavender | textMuted / surfaceAlt | 4.687:1 | PASS |
| Lavender | primary / bg | 6.864:1 | PASS |
| Lavender | primary / bgElevated | 7.440:1 | PASS |
| Lavender | primary / surface | 6.181:1 | PASS |
| Lavender | primary / surfaceAlt | 5.571:1 | PASS |
| Lavender | accent / bg | 6.872:1 | PASS |
| Lavender | accent / bgElevated | 7.448:1 | PASS |
| Lavender | accent / surface | 6.188:1 | PASS |
| Lavender | accent / surfaceAlt | 5.578:1 | PASS |
| Lavender | success / bg | 7.011:1 | PASS |
| Lavender | success / bgElevated | 7.599:1 | PASS |
| Lavender | success / surface | 6.313:1 | PASS |
| Lavender | success / surfaceAlt | 5.690:1 | PASS |
| Lavender | warning / bg | 6.599:1 | PASS |
| Lavender | warning / bgElevated | 7.152:1 | PASS |
| Lavender | warning / surface | 5.942:1 | PASS |
| Lavender | warning / surfaceAlt | 5.356:1 | PASS |
| Lavender | danger / bg | 7.231:1 | PASS |
| Lavender | danger / bgElevated | 7.837:1 | PASS |
| Lavender | danger / surface | 6.511:1 | PASS |
| Lavender | danger / surfaceAlt | 5.868:1 | PASS |
| Lavender | primaryContrast / primary | 7.440:1 | PASS |
| Lavender | bubbleTheirsText / bubbleTheirs | 11.026:1 | PASS |
| Lavender | bubbleMineText / bubbleMine gradient (1001 samples) | 7.440:1 | PASS |
| Lavender | tickSent / bubbleMine gradient (1001 samples) | 4.914:1 | PASS |
| Lavender | tickSeen / bubbleMine gradient (1001 samples) | 7.440:1 | PASS |
| Forest | textPrimary / bg | 16.588:1 | PASS |
| Forest | textPrimary / bgElevated | 14.429:1 | PASS |
| Forest | textPrimary / surface | 12.479:1 | PASS |
| Forest | textPrimary / surfaceAlt | 10.491:1 | PASS |
| Forest | textSecondary / bg | 12.787:1 | PASS |
| Forest | textSecondary / bgElevated | 11.123:1 | PASS |
| Forest | textSecondary / surface | 9.619:1 | PASS |
| Forest | textSecondary / surfaceAlt | 8.087:1 | PASS |
| Forest | textMuted / bg | 9.962:1 | PASS |
| Forest | textMuted / bgElevated | 8.665:1 | PASS |
| Forest | textMuted / surface | 7.494:1 | PASS |
| Forest | textMuted / surfaceAlt | 6.300:1 | PASS |
| Forest | primary / bg | 10.970:1 | PASS |
| Forest | primary / bgElevated | 9.542:1 | PASS |
| Forest | primary / surface | 8.252:1 | PASS |
| Forest | primary / surfaceAlt | 6.938:1 | PASS |
| Forest | accent / bg | 11.260:1 | PASS |
| Forest | accent / bgElevated | 9.795:1 | PASS |
| Forest | accent / surface | 8.471:1 | PASS |
| Forest | accent / surfaceAlt | 7.121:1 | PASS |
| Forest | success / bg | 11.728:1 | PASS |
| Forest | success / bgElevated | 10.201:1 | PASS |
| Forest | success / surface | 8.822:1 | PASS |
| Forest | success / surfaceAlt | 7.417:1 | PASS |
| Forest | warning / bg | 11.936:1 | PASS |
| Forest | warning / bgElevated | 10.382:1 | PASS |
| Forest | warning / surface | 8.979:1 | PASS |
| Forest | warning / surfaceAlt | 7.549:1 | PASS |
| Forest | danger / bg | 10.518:1 | PASS |
| Forest | danger / bgElevated | 9.149:1 | PASS |
| Forest | danger / surface | 7.912:1 | PASS |
| Forest | danger / surfaceAlt | 6.652:1 | PASS |
| Forest | primaryContrast / primary | 9.287:1 | PASS |
| Forest | bubbleTheirsText / bubbleTheirs | 10.491:1 | PASS |
| Forest | bubbleMineText / bubbleMine gradient (1001 samples) | 8.844:1 | PASS |
| Forest | tickSent / bubbleMine gradient (1001 samples) | 5.970:1 | PASS |
| Forest | tickSeen / bubbleMine gradient (1001 samples) | 8.434:1 | PASS |
