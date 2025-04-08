package de.devlodge.hedera.account.export.ledgers.hedera;

import de.devlodge.hedera.account.export.exchange.ExchangeClient;
import de.devlodge.hedera.account.export.ledgers.LedgerClient;
import de.devlodge.hedera.account.export.model.Network;
import de.devlodge.hedera.account.export.model.Transaction;
import de.devlodge.hedera.account.export.model.Currency;
import de.devlodge.hedera.account.export.exchange.ExchangePair;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class HederaClient implements LedgerClient {

    public static final BigDecimal TINY_BAR_TO_HBAR_FACTOR = new BigDecimal(100_000_000);

    public List<Transaction> getAllTransactionsForAccount(final String accountId) throws Exception {
        final var hederaTransaction = new HederaMirrorNodeHttpClient().request(accountId);
        return convert(hederaTransaction, accountId);
    }

    private List<Transaction> convert(final List<HederaTransaction> hederaTransactions, final String accountId) {
        final HederaAccount account = new HederaAccount(accountId);
        return hederaTransactions.stream()
                .flatMap(t -> convert(t, account).stream())
                .toList();
    }

    private List<Transaction> convert(final HederaTransaction hederaTransaction, final HederaAccount account) {
        List<Transaction> result = new ArrayList<>();

        hederaTransaction.hederaTransfers().stream()
                .filter(t -> t.account().equals(account.getAccountId()))
                .map(t -> convert(hederaTransaction, t, false, account))
                .forEach(result::add);
        hederaTransaction.stakingRewardHederaTransfers().stream()
                .filter(t -> t.account().equals(account.getAccountId()))
                .map(t -> convert(hederaTransaction, t, true, account))
                .forEach(result::add);
        return Collections.unmodifiableList(result);
    }

    private Transaction convert(final HederaTransaction hederaTransaction, final HederaTransfer hederaTransfer, boolean isStakingReward, final HederaAccount account) {
        try {
            final Instant timestamp = getInstantFromTimestamp(hederaTransaction.timestamp());
            final BigDecimal hbarAmount = new BigDecimal(hederaTransfer.amount()).divide(TINY_BAR_TO_HBAR_FACTOR);
            // final String to = hederaTransfer.account();
            // System.out.println(to);
            final BigDecimal hbarBalance = account.addHbarBalance(hbarAmount);
            return new Transaction(Network.HEDERA_MAINNET, UUID.randomUUID(), hederaTransaction.transaction_id(),
                    timestamp, hbarAmount,
                    isStakingReward,
                    hbarBalance, account.getAccountId());
        } catch (Exception e) {
            throw new RuntimeException("Can not create transaction", e);
        }
    }

    public static Instant getInstantFromTimestamp(final String timestamp) {
        final var timestampSplits = timestamp.split("\\.");
        final long seconds = Long.parseLong(timestampSplits[0]);
        final long nanos = Long.parseLong(timestampSplits[1]);
        return Instant.ofEpochSecond(seconds, nanos);
    }
}
