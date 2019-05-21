import { Component, Mixin } from 'src/core/shopware';
import Criteria from 'src/core/data-new/criteria.data';
import template from './sw-product-list.twig';
import './sw-product-list.scss';

Component.register('sw-product-list', {
    template,

    inject: ['repositoryFactory', 'context'],

    mixins: [
        Mixin.getByName('notification'),
        Mixin.getByName('listing'),
        Mixin.getByName('placeholder')
    ],

    data() {
        return {
            products: null,
            currencies: {},
            showDeleteModal: false,
            sortBy: 'productNumber',
            sortDirection: 'DESC',
            naturalSorting: true,
            isLoading: false,
            total: 0
        };
    },

    metaInfo() {
        return {
            title: this.$createTitle()
        };
    },

    computed: {
        productRepository() {
            return this.repositoryFactory.create('product');
        },

        productColumns() {
            return this.getProductColumns();
        },

        currencyRepository() {
            return this.repositoryFactory.create('currency');
        },

        filters() {
            return [{
                active: false,
                label: 'Preis über 50€',
                criteria: { type: 'range', field: 'product.price', options: { '>': 50 } }
            }, {
                active: false,
                label: 'Lagerbestand unter 10',
                criteria: { type: 'range', field: 'product.stock', options: { '<': 10 } }
            }];
        },

        currencyList() {
            if (!this.currencies.items) {
                return [];
            }

            return Object.values(this.currencies.items);
        },

        currenciesColumns() {
            return this.currencyList.sort((a, b) => {
                return b.isDefault ? 1 : -1;
            }).map(item => {
                return {
                    property: `price-${item.isoCode}`,
                    dataIndex: `price-${item.id}`,
                    label: `${item.name}`,
                    routerLink: 'sw.product.detail',
                    allowResize: true,
                    visible: item.isDefault,
                    align: 'right'
                };
            });
        }
    },

    filters: {
        stockColorVariant(value) {
            if (value > 25) {
                return 'success';
            }
            if (value < 25 && value > 0) {
                return 'warning';
            }

            return 'error';
        }
    },

    methods: {
        getList() {
            this.isLoading = true;

            const productCriteria = new Criteria(this.page, this.limit);
            this.naturalSorting = this.sortBy === 'productNumber';

            productCriteria.setTerm(this.term);
            productCriteria.addFilter(Criteria.equals('product.parentId', null));
            productCriteria.addSorting(Criteria.sort(this.sortBy, this.sortDirection, this.naturalSorting));
            productCriteria.addAssociation('cover');
            productCriteria.addAssociation('manufacturer');

            const currencyCriteria = new Criteria(1, 500);

            return Promise.all([
                this.productRepository.search(productCriteria, this.context),
                this.currencyRepository.search(currencyCriteria, this.context)
            ]).then((res) => {
                const products = res[0];
                const currencies = res[1];

                this.total = products.total;
                this.products = products;

                this.currencies = currencies;
                this.isLoading = false;
            }).catch(() => {
                this.isLoading = false;
            });
        },

        onInlineEditSave(promise, product) {
            const productName = product.name || this.placeholder(product, 'name');

            return promise.then(() => {
                this.createNotificationSuccess({
                    title: this.$tc('sw-product.list.titleSaveSuccess'),
                    message: this.$tc('sw-product.list.messageSaveSuccess', 0, { name: productName })
                });
            }).catch(() => {
                this.getList();
                this.createNotificationError({
                    title: this.$tc('global.notification.notificationSaveErrorTitle'),
                    message: this.$tc('global.notification.notificationSaveErrorMessage', 0, { entityName: productName })
                });
            });
        },

        onInlineEditCancel(product) {
            product.discardChanges();
        },

        onChangeLanguage(languageId) {
            this.context.languageId = languageId;
            this.getList();
        },

        onDelete(id) {
            this.showDeleteModal = id;
        },

        onCloseDeleteModal() {
            this.showDeleteModal = false;
        },

        onConfirmDelete(id) {
            this.showDeleteModal = false;

            return this.productRepository.delete(id, this.context).then(() => {
                this.getList();
            });
        },

        getCurrencyPriceByCurrencyId(itemId, currencyId) {
            let foundPrice = {
                currencyId: null,
                gross: null,
                linked: true,
                net: null
            };

            // check if products are loaded
            if (!this.products) {
                return foundPrice;
            }

            // find product for itemId
            const foundProduct = Object.values(this.products.items).find((item) => {
                return item.id === itemId;
            });

            // find price from product with currency id
            if (foundProduct) {
                const priceForProduct = Object.values(foundProduct.price).find((price) => {
                    return price.currencyId === currencyId;
                });

                if (priceForProduct) {
                    foundPrice = priceForProduct;
                }
            }

            // return the price
            return foundPrice;
        },

        getProductColumns() {
            return [{
                property: 'name',
                label: this.$tc('sw-product.list.columnName'),
                routerLink: 'sw.product.detail',
                inlineEdit: 'string',
                allowResize: true,
                primary: true
            }, {
                property: 'productNumber',
                naturalSorting: true,
                label: this.$tc('sw-product.list.columnProductNumber'),
                align: 'right',
                allowResize: true
            }, {
                property: 'manufacturer.name',
                label: this.$tc('sw-product.list.columnManufacturer'),
                allowResize: true
            }, {
                property: 'active',
                label: this.$tc('sw-product.list.columnActive'),
                inlineEdit: 'boolean',
                allowResize: true,
                align: 'center'
            },
            ...this.currenciesColumns,
            {
                property: 'stock',
                label: this.$tc('sw-product.list.columnInStock'),
                inlineEdit: 'number',
                allowResize: true,
                align: 'right'
            }];
        }
    }
});
