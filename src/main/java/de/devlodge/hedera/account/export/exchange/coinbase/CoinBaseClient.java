package de.devlodge.hedera.account.export.exchange.coinbase;

import de.devlodge.hedera.account.export.exchange.ExchangeClient;
import de.devlodge.hedera.account.export.exchange.ExchangePair;
import de.devlodge.hedera.account.export.storage.StorageService;
import de.devlodge.hedera.account.export.utils.HttpUtils;
import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.context.annotation.ApplicationScope;

@Service
@ApplicationScope
public class CoinBaseClient implements ExchangeClient {

    private final static Logger log = LoggerFactory.getLogger(CoinBaseClient.class);

    private static final String BASE_URL = "https://api.coinbase.com/";
    private static final String PRICES_URL = BASE_URL + "v2/prices/%s/spot?date=%s";
    public static final String YYYY_MM_DD = "yyyy-MM-dd";
    public static final String TIMEZONE_DE = "Europe/Berlin";
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern(YYYY_MM_DD).withZone(ZoneId.of(
            TIMEZONE_DE));

    private final StorageService storageService;

    private final HttpClient client;

    private final List<Exchange> exchanges = new CopyOnWriteArrayList<>();

    @Autowired
    public CoinBaseClient(StorageService storageService) {
        client = HttpClient.newHttpClient();
        this.storageService = Objects.requireNonNull(storageService, "storageService");
    }

    @Override
    public BigDecimal getCurrentExchangeRate(ExchangePair pair) throws Exception {
        return getExchangeRate(pair,
                LocalDate.now(ZoneId.systemDefault()).atStartOfDay(ZoneId.systemDefault()).toInstant());
    }

    public BigDecimal getExchangeRate(final ExchangePair pair, final Instant date) {
        Objects.requireNonNull(pair, "pair must not be null");
        Objects.requireNonNull(date, "date must not be null");

        return storageService.getExchangeRate(pair, date).orElseGet(() -> {
            log.info("Requesting exchange rate for {} on date {}", pair, date);
            LocalDate dateToUse = ZonedDateTime.ofInstant(date, ZoneId.of(TIMEZONE_DE)).toLocalDate();
            final Exchange exchange = exchanges.stream()
                    .filter(e -> e.date().equals(dateToUse) && e.pair().equals(pair))
                    .findFirst()
                    .orElseGet(() -> {
                        try {
                            // final String url = String.format(PRICES_URL, pair, DATE_FORMATTER.format(date));
                            // System.err.println(url);
                            // final BigDecimal rate = HttpUtils.getJsonElementForGetRequest(client, url)
                            //         .getAsJsonObject()
                            //         .getAsJsonObject("data")
                            //         .getAsJsonPrimitive("amount")
                            //         .getAsBigDecimal();
                            final BigDecimal rate = new BigDecimal("0.001");

                            final Exchange e = new Exchange(dateToUse, pair, rate);
                            exchanges.add(e);
                            return e;
                        } catch (Exception e) {
                            throw new RuntimeException("Error in fetching exchange", e);
                        }
                    });
            storageService.addExchangeRate(pair, date, exchange.rate());
            return exchange.rate();
        });
    }

    private record Exchange(LocalDate date, ExchangePair pair, BigDecimal rate) {
    }

}
