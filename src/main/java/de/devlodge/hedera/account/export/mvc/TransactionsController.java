package de.devlodge.hedera.account.export.mvc;

import de.devlodge.hedera.account.export.exchange.ExchangeClient;
import de.devlodge.hedera.account.export.exchange.ExchangePair;
import de.devlodge.hedera.account.export.model.Currency;
import de.devlodge.hedera.account.export.model.Transaction;
import de.devlodge.hedera.account.export.session.SessionStore;
import de.devlodge.hedera.account.export.storage.StorageService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

@Controller
public class TransactionsController {

    private final SessionStore transactionService;

    private final StorageService noteService;

    private final ExchangeClient exchangeClient;

    @Autowired
    public TransactionsController(final SessionStore transactionService, final StorageService noteService,
            ExchangeClient exchangeClient) {
        this.transactionService = Objects.requireNonNull(transactionService);
        this.noteService = Objects.requireNonNull(noteService);
        this.exchangeClient = Objects.requireNonNull(exchangeClient);
    }

    @RequestMapping(value = "/transactions", method = RequestMethod.GET)
    public String showTransactions(final Model model) {
        Objects.requireNonNull(model);
        final List<TransactionModel> transactions = transactionService.getTransactions()
                .stream()
                .map(t -> convert(t))
                // .filter(t -> !"SCAM".equals(t.note()))
                .toList();
        model.addAttribute("transactions", transactions);
        return "transactions";
    }

    @RequestMapping(value = "/transaction/{id}", method = RequestMethod.GET)
    public String getById(final Model model, @PathVariable String id) {
        Objects.requireNonNull(model);
        Objects.requireNonNull(id);
        final Optional<Transaction> transaction = transactionService.getById(id);
        if (transaction.isEmpty()) {
            throw new RuntimeException("Transaction with id " + id + " not found");
        } else {
            final TransactionModel transactionModel = transaction.map(t -> convert(t)).get();
            model.addAttribute("transaction", transactionModel);
            return "transaction";
        }
    }

    @RequestMapping(value = "/transaction/{id}", method = RequestMethod.POST)
    public String saveNote(final Model model, @ModelAttribute("transaction") TransactionModel transactionModel) {
        Objects.requireNonNull(transactionModel);
        final Transaction transaction = transactionService.getById(transactionModel.id()).orElseThrow();
        noteService.addNote(transaction, transactionModel.note());
        return "redirect:/transactions";
    }

    private TransactionModel convert(final Transaction transaction) {
        final BigDecimal exchangeRate = getExchangeRate(transaction);
        final BigDecimal amount = transaction.amount().multiply(exchangeRate);
        final BigDecimal balanceAfterTransaction = transaction.balanceAfterTransaction().multiply(exchangeRate);
        final String note = noteService.getNote(transaction).orElseGet(() -> {
            if (transaction.isStakingReward()) {
                return "Staking Reward";
            } else if (Math.abs(transaction.amount().doubleValue()) < 0.005d) {
                return "SCAM";
            }
            return "";
        });

        return new TransactionModel(
                transaction.id().toString(),
                transaction.networkId(),
                MvcUtils.formatTransactionLink(transaction.networkId()),
                MvcUtils.formatTimestamp(transaction.timestamp()),
                MvcUtils.getHBarFormatted(transaction.amount()),
                MvcUtils.getUsdFormatted(amount),
                note,
                MvcUtils.getHBarFormatted(transaction.balanceAfterTransaction()),
                MvcUtils.getUsdFormatted(balanceAfterTransaction),
                transaction.accountId(),
                MvcUtils.getUsdFormatted(exchangeRate)
                );
    }


    private BigDecimal getExchangeRate(final Transaction transaction) {
        try {
            return exchangeClient.getExchangeRate(new ExchangePair(Currency.HBAR, Currency.USD),
                    transaction.timestamp());
        } catch (Exception e) {
            throw new RuntimeException("Can not get exchange rate", e);
        }
    }

    public record TransactionModel(String id, String hederaTransactionId, String hederaTransactionLink,
                                   String timestamp, String hbarAmount, String amount,
                                   String note, String hbarBalanceAfterTransaction, String balanceAfterTransaction, String accountId, String exchangeRate) {
    }

}
