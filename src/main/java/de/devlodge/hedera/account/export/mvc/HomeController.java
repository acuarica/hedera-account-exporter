package de.devlodge.hedera.account.export.mvc;

import de.devlodge.hedera.account.export.exchange.ExchangeClient;
import de.devlodge.hedera.account.export.exchange.ExchangePair;
import de.devlodge.hedera.account.export.model.Currency;
import de.devlodge.hedera.account.export.model.Transaction;
import de.devlodge.hedera.account.export.session.SessionStore;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

@Controller
public class HomeController {

    private final static Logger log = LoggerFactory.getLogger(HomeController.class);

    private final SessionStore transactionService;

    private final ExchangeClient exchangeClient;

    @Autowired
    public HomeController(final SessionStore transactionService, ExchangeClient exchangeClient) {
        this.transactionService = Objects.requireNonNull(transactionService);
        this.exchangeClient = Objects.requireNonNull(exchangeClient);
    }

    @RequestMapping(value = "/", method = RequestMethod.GET)
    public String index(final Model model) throws Exception {
        Objects.requireNonNull(model);
        return "index";
    }

    @RequestMapping(value = "/", method = RequestMethod.POST)
    public String storeAccountId(final Model model, String accountId) throws Exception {
        Objects.requireNonNull(model);
        final String accountIdToStore = Optional.ofNullable(accountId)
                .filter(id -> !id.isBlank())
                .orElse(null);
        log.info("Logging in account id: {}", accountIdToStore);
        try {
            transactionService.setAccountId(accountIdToStore);
        } catch (Exception e) {
            log.error("Error setting account id", e);
            return "index";
        }
        return "redirect:/home";
    }

    @RequestMapping(value = "/logout", method = RequestMethod.GET)
    public String logout(final Model model) throws Exception {
        transactionService.setAccountId(null);
        return "redirect:/";
    }


    @RequestMapping(value = "/home", method = RequestMethod.GET)
    public String home(final Model model) throws Exception {
        Objects.requireNonNull(model);
        if (!transactionService.accountId().isPresent()) {
            return "redirect:/";
        }
        final List<Transaction> transactions = transactionService.getTransactions();
        final ExchangePair exchangePair = new ExchangePair(Currency.HBAR, Currency.USD);
        final BigDecimal exchangeRate = exchangeClient.getCurrentExchangeRate(exchangePair);
        model.addAttribute("exchangeRate", MvcUtils.getUsdFormatted(exchangeRate));

        if (!transactions.isEmpty()) {
            final BigDecimal hbarAmount = transactions.get(transactions.size() - 1).balanceAfterTransaction();
            model.addAttribute("hbarAmount", MvcUtils.getHBarFormatted(hbarAmount));

            final BigDecimal eurAmount = hbarAmount.multiply(exchangeRate);
            model.addAttribute("eurAmount", MvcUtils.getUsdFormatted(eurAmount));

            final BigDecimal stackingHbarAmount = transactions.stream()
                    .filter(transaction -> transaction.isStakingReward())
                    .map(Transaction::amount)
                    .reduce(new BigDecimal(0), (a, b) -> a.add(b));
            model.addAttribute("stackedHbar", MvcUtils.getHBarFormatted(stackingHbarAmount));

            final BigDecimal stackingEurAmount = stackingHbarAmount.multiply(exchangeRate);
            model.addAttribute("stackedEur", MvcUtils.getUsdFormatted(stackingEurAmount));
        }
        return "home";
    }
}
