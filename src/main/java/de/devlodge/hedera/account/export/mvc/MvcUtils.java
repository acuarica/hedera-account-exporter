package de.devlodge.hedera.account.export.mvc;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Objects;

public class MvcUtils {


    public static String getHBarFormatted(BigDecimal hbarAmount) {
        Objects.requireNonNull(hbarAmount, "hbarAmount must not be null");
        DecimalFormat df = new DecimalFormat();
        df.setMaximumFractionDigits(2);
        df.setMinimumFractionDigits(2);
        df.setGroupingUsed(true);
        // return df.format(hbarAmount) + " ℏ";
        return df.format(hbarAmount) + "";
    }

    public static String getUsdFormatted(BigDecimal amount) {
        return getUsdFormatted(amount, 4);
    }

    public static String getUsdFormatted(BigDecimal amount, int fractionDigits) {
        Objects.requireNonNull(amount, "amount must not be null");
        DecimalFormat df = new DecimalFormat();
        df.setMaximumFractionDigits(fractionDigits);
        df.setMinimumFractionDigits(fractionDigits);
        df.setGroupingUsed(true);
        // return df.format(amount) + " $";
        return df.format(amount) + "";
    }

    public static String formatTimestamp(Instant timestamp) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd.MM.yyyy")
                .withZone(ZoneId.systemDefault());
        return formatter.format(timestamp);
    }

    public static String formatTransactionLink(String hederaTransactionId) {
        return "https://hashscan.io/mainnet/transaction/" + hederaTransactionId;
    }
}
