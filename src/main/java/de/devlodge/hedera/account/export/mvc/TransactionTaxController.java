package de.devlodge.hedera.account.export.mvc;

import de.devlodge.hedera.account.export.exchange.ExchangeClient;
import de.devlodge.hedera.account.export.exchange.ExchangePair;
import de.devlodge.hedera.account.export.model.Currency;
import de.devlodge.hedera.account.export.model.Transaction;
import de.devlodge.hedera.account.export.session.SessionStore;
import de.devlodge.hedera.account.export.storage.StorageService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

@Controller
public class TransactionTaxController {

    private final SessionStore transactionService;

    private final StorageService noteService;

    private final ExchangeClient exchangeClient;

    @Autowired
    public TransactionTaxController(final SessionStore transactionService, final StorageService noteService,
            ExchangeClient exchangeClient) {
        this.transactionService = Objects.requireNonNull(transactionService);
        this.noteService = Objects.requireNonNull(noteService);
        this.exchangeClient = Objects.requireNonNull(exchangeClient);
    }

    @RequestMapping(value = "/transactions-tax", method = RequestMethod.GET)
    public String showTransactionsTax(final Model model) {
        Objects.requireNonNull(model);

        final List<TransactionWithFifo> transactionsWithFifo = new ArrayList<>();
        final List<Transaction> transactions = transactionService.getTransactions();
        AtomicReference<BigDecimal> cumulativeCostInEur = new AtomicReference<>(BigDecimal.ZERO);
        transactions.stream().sorted(Comparator.comparing(Transaction::timestamp)).forEach(t -> {
            final BigDecimal exchangeRate = getExchangeRate(t);
            final List<TransactionWithFifo> preTransactionsWithFifo = new ArrayList<>(transactionsWithFifo);
            final String note = noteService.getNote(t).orElseGet(() -> {
                if (t.isStakingReward()) {
                    return "Staking Reward";
                } else {
                    return "";
                }
            });
            final TransactionWithFifo transactionWithFifo = new TransactionWithFifo(transactions.indexOf(t), t,
                    exchangeRate,
                    preTransactionsWithFifo, cumulativeCostInEur.get(), note);
            cumulativeCostInEur.set(transactionWithFifo.cumulativeCostInEur);
            transactionsWithFifo.add(transactionWithFifo);
        });
        model.addAttribute("transactions", transactionsWithFifo.stream().map(TransactionWithFifo::toTransactionTaxModel)
                .toList());
        return "transactions-tax";
    }

    private class TransactionWithFifo {

        private final int index;

        private final Transaction transaction;

        private final BigDecimal exchangeRate;

        private final BigDecimal cumulativeCostInEur;

        private BigDecimal openFifoInHBAR;

        private final BigDecimal euroAmount;

        private final List<FifoUsage> usedFifoFor = new ArrayList<>();

        private final List<FifoUsage> usedFifoBy = new ArrayList<>();

        private final String note;

        public TransactionWithFifo(int index, Transaction transaction, final BigDecimal exchangeRate,
                List<TransactionWithFifo> preTransactionsWithFifo, BigDecimal prevCumulativeCostInEur, String note) {
            this.index = index;
            this.transaction = transaction;
            this.exchangeRate = exchangeRate;
            this.note = note;
            if (isPositive(transaction.amount())) {
                openFifoInHBAR = transaction.amount();
            } else {
                openFifoInHBAR = BigDecimal.ZERO;
            }
            if (isNegative(transaction.amount())) {
                BigDecimal remainingAmount = transaction.amount().abs();
                for (TransactionWithFifo preTransactionWithFifo : preTransactionsWithFifo) {
                    if (isZero(remainingAmount)) {
                        break;
                    }
                    if (isPositive(preTransactionWithFifo.openFifoInHBAR)) {
                        final BigDecimal fifo = preTransactionWithFifo.openFifoInHBAR.min(remainingAmount);
                        preTransactionWithFifo.openFifoInHBAR = preTransactionWithFifo.openFifoInHBAR.subtract(fifo);
                        remainingAmount = remainingAmount.subtract(fifo);
                        final BigDecimal fifoInEur = fifo.multiply(preTransactionWithFifo.exchangeRate)
                                .setScale(2, RoundingMode.HALF_UP);
                        usedFifoBy.add(new FifoUsage(preTransactionWithFifo.index, fifo, fifoInEur));
                        preTransactionWithFifo.usedFifoFor.add(new FifoUsage(index, fifo.negate(), fifoInEur.negate()));
                    }
                }
                if (!isZero(remainingAmount)) {
                    throw new RuntimeException("Can not calculate FIFO. Remaining Fifo=" + remainingAmount
                            + " for transaction " + transaction.id() + " with amount " + transaction.amount());
                }
            }

            if (isNegative(transaction.amount())) {
                euroAmount = usedFifoBy.stream().map(i -> i.amountInEur)
                        .map(a -> a.setScale(2, RoundingMode.HALF_UP))
                        .reduce(BigDecimal.ZERO, (a, b) -> a.add(b)).negate();
            } else {
                euroAmount = transaction.amount().multiply(exchangeRate).setScale(2, RoundingMode.HALF_UP);
            }
            this.cumulativeCostInEur = prevCumulativeCostInEur.setScale(2, RoundingMode.HALF_UP)
                    .add(euroAmount).setScale(2, RoundingMode.HALF_UP);
        }


        public TransactionTaxModel toTransactionTaxModel() {
            final String usedFifoByString = usedFifoBy.stream()
                    .map(i -> i.index + " (" + MvcUtils.getHBarFormatted(i.amountInHBAR) + " / "
                            + MvcUtils.getUsdFormatted(i.amountInEur) + ")")
                    .reduce((a, b) -> a + System.lineSeparator() + b)
                    .orElseGet(() -> "");
            final String usedFifoForString = usedFifoFor.stream()
                    .map(i -> i.index + " (" + MvcUtils.getHBarFormatted(i.amountInHBAR) + " / "
                            + MvcUtils.getUsdFormatted(i.amountInEur) + ")")
                    .reduce((a, b) -> a + System.lineSeparator() + b)
                    .orElseGet(() -> "");
            final String usedFifoString;
            if (usedFifoByString.isEmpty()) {
                usedFifoString = usedFifoForString;
            } else if (usedFifoForString.isEmpty()) {
                usedFifoString = usedFifoByString;
            } else {
                usedFifoString = usedFifoByString + System.lineSeparator() + usedFifoForString;
            }

            final String exchnageRateAsString;
            if (isNegative(transaction.amount())) {
                exchnageRateAsString = "-";
            } else {
                exchnageRateAsString = MvcUtils.getUsdFormatted(
                        transaction.amount().multiply(exchangeRate).setScale(2, RoundingMode.HALF_UP));
            }
            final String openFifoInEur;
            if (isNegative(transaction.amount())) {
                openFifoInEur = "-";
            } else {
                openFifoInEur = MvcUtils.getUsdFormatted(
                        openFifoInHBAR.multiply(exchangeRate).setScale(2, RoundingMode.HALF_UP));
            }
            return new TransactionTaxModel(index,
                    transaction.id().toString(),
                    transaction.networkId(),
                    MvcUtils.formatTimestamp(transaction.timestamp()),
                    MvcUtils.getHBarFormatted(transaction.amount()),
                    MvcUtils.getUsdFormatted(euroAmount),
                    MvcUtils.getUsdFormatted(cumulativeCostInEur),
                    note,
                    MvcUtils.getHBarFormatted(transaction.balanceAfterTransaction()),
                    openFifoInEur,
                    exchnageRateAsString,
                    usedFifoString);
        }
    }

    private static boolean isPositive(BigDecimal value) {
        return value.compareTo(BigDecimal.ZERO) > 0;
    }

    private static boolean isNegative(BigDecimal value) {
        return value.compareTo(BigDecimal.ZERO) < 0;
    }

    private static boolean isZero(BigDecimal value) {
        return value.compareTo(BigDecimal.ZERO) == 0;
    }

    private BigDecimal getExchangeRate(final Transaction transaction) {
        try {
            return exchangeClient.getExchangeRate(new ExchangePair(Currency.HBAR, Currency.USD),
                    transaction.timestamp());
        } catch (Exception e) {
            throw new RuntimeException("Can not get exchange rate", e);
        }
    }

    public record TransactionTaxModel(int index,
                                      String id,
                                      String hederaTransactionId,
                                      String timestamp,
                                      String hbarAmount,
                                      String eurAmount,
                                      String cumulativeCostInEur,
                                      String note,
                                      String hbarBalanceAfterTransaction,
                                      String fifoInEur,
                                      String exchangeRate,
                                      String fifoUsage) {
    }

    public record FifoUsage(int index, BigDecimal amountInHBAR, BigDecimal amountInEur) {
    }

}
