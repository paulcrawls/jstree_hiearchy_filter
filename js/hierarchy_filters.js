(function () {

/**
 * Hierarchy filter widget
 * Type:
 * type == 1  => single choice
 * type == 2  => multi choice
 * type == 3  => single choice only leaf
 * type == 4  => multi choice only leaf
 */

var HIERARCHY_FILTER_TYPE = {
    SINGLE_CHOICE: 1,
    MULTI_CHOICE: 2,
    SINGLE_CHOICE_ONLY_LEAF: 3,
    MULTI_CHOICE_ONLY_LEAF: 4,
    is_single_choice: function (type) {
        return type === this.SINGLE_CHOICE || type === this.SINGLE_CHOICE_ONLY_LEAF;
    },
    is_multi_choise: function (type) {
        return type === this.MULTI_CHOICE || type === this.MULTI_CHOICE_ONLY_LEAF;
    }
};

Object.freeze(HIERARCHY_FILTER_TYPE);

/** функции проверки состояния нода*/
function _is_not_clickable($element) {
    return $element.attr('data-not_clickable') === 'true';
}
function _is_deleted($element) {
    return $element.attr('data-deleted') === 'true';
}
/**
 * Исключает из конфигурации JSTree указанные плагины.
 * 
 * @param {Object} config Конфигурация JSTree.
 * @param {Array} plugins Имена плагинов для отключения.
 * @static
 * @private
 */
function _disable_tree_plugins(config, plugins) {
    config.plugins = config.plugins.filter(function (plugin_name) { return plugins.indexOf(plugin_name) === -1; });
}

var defaultOptions = {
        type: HIERARCHY_FILTER_TYPE.MULTI_CHOICE,
        selected: [],
        url: '',
        data: [],
        disabled: false,
        placeholder: "Выберите значение...",
        label: "Выбранные значения",
        /*упрощенное дерево (без кнопок)*/
        simplified: false,
        /*показать/скрыть чекбокс удаленных*/
        show_checkbox_hide_deleted: false
    },
    defaultJSTreeConfig = {
        "core" : {
            'data' : []
        },
        "checkbox" : {
            "keep_selected_style" : false
        },
        "search" : {
            "case_insensitive" : true,
            "show_only_matches" : true,
            "fuzzy" : false
        },
        "sort" :  function (A, B) {
            var a = this.get_text(A).toLocaleLowerCase(),
                b = this.get_text(B).toLocaleLowerCase();

            if (a > b) return 1;
            if (a < b) return -1;
            return 0;
        },
        "plugins" : [ "checkbox", "search", "sort", "state", "changed" ]
    },
    hierarchyButtons = [
        {
            class_name: 'action_approve',
            text: 'Применить',
            title: 'Сохраняет выбранные значения и закрывает фильтр',
            callback_name: '_button_approve'
        },
        {
            class_name: 'action_cancel',
            title: 'Закрывает фильтр без сохранения изменений',
            text: 'Отмена',
            callback_name: '_button_cancel'
        },
        {
            class_name: 'action_minimize',
            title: 'Сворачивает иерархию',
            text: 'Свернуть',
            callback_name: '_button_minimize'
        },
        {
            class_name: 'action_clear',
            title: 'Очищает выбранные значения',
            text: 'Очистить',
            callback_name: '_button_clear'
        }
    ];

var hierarchyFilter = {

    options: defaultOptions,
    _old_result: [],
    _refresh_hash: '',
    _document_event: function () {},

    is_single_choice: function () {
        return HIERARCHY_FILTER_TYPE.is_single_choice(this.options.type);
    },

    /**методы взаимодействия с деревом*/
    open_tree: function () {
        if (this.options.disabled) {
            return;
        }

        this._change_state(true);
    },
    close_tree: function () {
        this._change_state(false);
        if (this._$main_input) this._$main_input.blur();
        this._$jstree_hidden_input.focus();
    },
    cancel: function () {
        var self = this;

        if (this._old_result.length === 0) {
            var val = this.get_search_string();

            this.clear({clear: 'value'});

            /** если ничего не выбрано в фильтре и юзер инициировал cancel */
            if (val.length > 0 && this._$main_input) {
                this._$main_input.keyup();
            }

            return;
        }

        if (this.is_single_choice()) {
            this._$tree_wrapper.find('li').each(function() {
                self._$jstree.jstree("enable_node", $(this).attr('id'));
            });
        }

        this._$jstree.jstree("deselect_all", true);

        this._read_selected_from_source_input();

        $.each(this.options.selected, function(_, value) {
            self._$jstree.jstree(true).select_node(value, true, true);
        });

        this._open_and_scroll_tree();
        this._set_main_input_placeholder();
    },
    clear: function (params) {
        var defaultParams = {
            withoutSaving: false,
            clear: 'all'
        };
        params = $.extend(true, defaultParams, params);

        if (params.clear == 'all' || params.clear == 'filter') {
            this.clear_filters();
        }

        if (params.clear == 'all' || params.clear == 'value') {
            this._$jstree.jstree("deselect_all", true);
            this._refresh_hash = '';
            if (!params.withoutSaving) {
                this._old_result = this.options.selected = [];
                this._write_selected_to_source_input(this._old_result);
                this._$jstree.jstree(true).redraw();
                if (this._$main_input) this._$main_input.val('');
                this._set_main_input_placeholder();
                this._open_top_node();
            } else {
                this._$jstree.jstree(true).redraw();
                this._open_top_node();
            }
        }
    },
    accept: function () {
        this._old_result = this.get_selected();
        this.options.selected = this._old_result.concat();

        if (!this.options.simplified) {
            this._$jstree.jstree(true).clear_search();
            
            this._minimize_nodes();
            this._open_and_scroll_tree();
            this._open_top_node();
        }

        if (this._$main_input) this._$main_input.change();
        this._write_selected_to_source_input(this._old_result);
        this._$jstree_hidden_input.change();
    },

    enable: function () {
        this.options.disabled = false;
        if (this._$main_input) {
            this._$main_input.prop('disabled', false);
            this._$jstree_input_wrapper.removeClass('jstree-disabled-input');
        }
        this._$jstree.jstree(true).select_node(this.options.selected, true, true);
        this._$tree_wrapper.removeClass('jstree-disabled');
    },
    disable: function () {
        this.options.disabled = true;
        if (this._$main_input) {
            this._$main_input.prop('disabled', true);
            this._$jstree_input_wrapper.addClass('jstree-disabled-input');
        }
        this._$tree_wrapper.addClass('jstree-disabled');
    },

    _change_state: function (state) {
        /** state == true => переключение в active */
        /** state == false => переключение в inactive */
        /** forward_zindex нужен для предеачи супер-з_индекса выше по DOM'у (используется для фиксированных шапок) */
        var forward_zindex = this._$jstree_hidden_input.data('forward_zindex'),
            $apply_to_elements = this._$tree_wrapper;
        if (forward_zindex && String(forward_zindex).length > 0) {
            $apply_to_elements = $apply_to_elements.add(this._$tree_wrapper.parents(forward_zindex));
        }

        if (state == true) {
            this._$tree_wrapper.addClass('active');
            $apply_to_elements.addClass('super_z-index');
        } else if (state == false) {
            this._$tree_wrapper.removeClass('active');
            $apply_to_elements.removeClass('super_z-index');
        }
    },
    is_active: function () {
        return this._$tree_wrapper.hasClass('active');
    },

    /**методы взаимодействия с данными*/
    get_selected: function() {
        var selected = [];
        this._split_not_clickable(this._$jstree.jstree('get_top_selected'), selected);
        return selected;
    },
    get_selected_name: function () { return ""; },
    get_search_string: function () {
        return this._$main_input ? this._$main_input.val() : "";
    },
    get_not_clickable_nodes: function () {
        return this._$tree_wrapper.find('li[data-not_clickable="true"]');
    },
    get_deleted_nodes: function () {
        return this._$tree_wrapper.find('li[data-deleted="true"]');
    },
    select: function(ids) {
        var generic_id_array = ids.split(",");
        if (this.is_single_choice() && generic_id_array.length > 1) {
            console.error('ERROR: trying to select more than one option while operating SINGLE type filter. First of the given options selected.');
            this.destroy();
        }

        this._$jstree.jstree(true).deselect_all(true);
        this._$jstree.jstree(true).select_node(generic_id_array, true, true);
        this.accept();
    },
    _open_and_scroll_tree: function() {
        var self = this;

        function scroll_opened_tree(ids) {
            if (ids.length > 0) {
                var $el = self._$tree_wrapper.find('li#' + ids),
                    scrollTo = 0;

                self._change_state(true);

                $el.ready(function() {
                    self.open_tree();
                    if ($el.length > 0) {
                        scrollTo = $el.offset().top - self._$jstree.offset().top;
                    }
                    if (scrollTo > 50) {
                        self._$jstree.scrollTop(scrollTo - 50);
                    }
                    self.close_tree();
                });

                self._change_state(false);
            } else {
                self.clear({clear: 'value'});
            }
        }
        /**открываем дерево и проматываем скролл в нем*/
        if (this._old_result.length > 0) {
            var selectedNode;

            if (this.is_single_choice()) {
                selectedNode = this.get_selected();
                self._$jstree.jstree(true)._open_to(selectedNode);
                scroll_opened_tree(selectedNode);
            } else {
                $.each(this.options.selected, function(index, value) {
                    if (index === 0) {
                        self._$jstree.jstree(true)._open_to(value);
                        scroll_opened_tree(value);
                        return;
                    }
                });
            }
        } else {
            self._open_top_node();
        }
    },
    /**
     * Раскрывает элемент <strong>единтсвенного</strong> корня.
     * @returns {undefined}
     */
    _open_top_node: function() {
        var self = this;
        if (self.options.data.length) {
            if (self._get_parent_nodes().length === 1) {
                this._$jstree.jstree("open_node", self._get_parent_node_id());
            }
        }
    },
    _split_not_clickable: function (items, selected) {
        var disabled_nodes = [],
            self = this;
        $.each(items, function(index, value) {
            var $el = self._$tree_wrapper.find('li#' + value);
            if (
                _is_not_clickable($el)
            ) {
                disabled_nodes.push(value);
            } else {
                selected.push(value);
            }
        });

        var jstree = this._$jstree.jstree(true);
        $.each(disabled_nodes, function(index, value) {
            var $children_of_current_disabled_node = jstree.get_node(value).children;
            if ($children_of_current_disabled_node) {
                self._split_not_clickable($children_of_current_disabled_node, selected);
            }
        });
    },
    _write_selected_to_source_input: function (selected) {
        this._$jstree_hidden_input.val(selected);
    },
    _read_selected_from_source_input: function () {
        var value = this._$jstree_hidden_input.val().replace(/^\[|\]$/g,'');

        this.options.selected = value.length === 0 ? [] : value.split(/, ?/);
    },

    /*методы загрузки данных*/
    update_json: function ($args) {
        var self = this;

        if ($args && $args.source.length !== 0) {
            return $.onceAjax({
                type: "GET",
                url: $args.source,
                data: $args.param,
                contentType: "application/json",
                syncObj: $args.object,
                success: function (data) {
                    self._$jstree.one("afterchange.jstree", function () {
                        self._set_selected(self._old_result);
                        self.accept();
                        if ($.isFunction($args.afterChange)) {
                            $args.afterChange();
                        }
                    });

                    if (data.length !== 0) {
                        self._update_jstree_data(data);
                    } else {
                        self._clear_data();
                    }
                }
            });
        }
    },
    update_data: function(data) {
        if (data.length > 0) {
            this._update_jstree_data(data);
        } else {
            this._clear_data();
        }
    },
    empty: function () {
        this._clear_data();
    },
    _load_json_and_update_tree: function(source, requestParam, result) {
		var that = this;
        $.getJSON(source, requestParam).done(function (data) { that._update_jstree_data(data); });
    },
    _update_jstree_data: function (data) {
        var jstreeWidget = this._$jstree.jstree(true);

        jstreeWidget.settings.core.data = this.options.data = data;
        this._refresh_hash = 'update_data';
        jstreeWidget.refresh(true, true);
    },
    _set_selected: function (preselectedNodeIdList) {
        this._reset_tree_nodes_state(preselectedNodeIdList);
        this._old_result = this.get_selected();
        this._write_selected_to_source_input(this.options.selected);

        this._set_main_input_placeholder();
    },
    _clear_data: function () {
        this._$jstree.jstree(true).settings.core.data = this.options.data = [];
        this._refresh_hash = 'clear_data';
        this._$jstree.jstree(true).refresh(true, true);
        this._set_main_input_placeholder();
    },

    _reset_tree_nodes_state: function (selectedNodeIdList) {
        /**находим и дисейблим удаленные*/
        var self = this,
            nodes_to_disable = self.get_deleted_nodes(),
            widget = self._$jstree.jstree(true);

        nodes_to_disable.each(function() {
            widget.disable_node($(this).attr('id'));
        });

        /**напрямую выбираем в дереве пришедшие значения*/
        selectedNodeIdList.forEach(function (id) {
            if (id.length && !_is_not_clickable(self._$jstree.find('li#' + id))) {
                widget.select_node(id, true, true);
            }
        });
    },

    _make_main_input: function (placeholder) {
        var timeout = false,
            self = this,
            autocomplete_search = function () {
                self._$jstree.jstree("search", this.value);
            };

        return $('<input type="text" class="jstree_input input">')
                .attr('placeholder', placeholder)
                .focus($.proxy(this.open_tree, this))
                .keyup(function () {
                    if (timeout) {
                        clearTimeout(timeout);
                    }

                    timeout = setTimeout(autocomplete_search.bind(this), 250);
                });
    },
    _make_buttons: function ($target) {
        var self = this,
            buttons = $.map(hierarchyButtons, function (buttonData) {
                var $button = $('<button type="button" class="hathi-button"></button>')
                        .attr('title', buttonData.title)
                        .addClass(buttonData.class_name)
                        .append($('<span class="button-text"></span>').html(buttonData.text))
                        .click($.proxy(self, buttonData.callback_name));

                return $button;
            });

        $target.append(buttons).append('<div class="clear"></div>');
    },
    _make_toggle_deleted_checkbox: function ($buttonsContainer) {
        var $checkbox = $('<div class="action_toggle_deleted">Скрыть удаленные</div>').click($.proxy(this._checkbox_switch_deleted, this));

        $buttonsContainer.append($checkbox);
    },

    _set_main_input_placeholder: function () {
        var placeholder = '';

        if (!this._$main_input) return;

        this._$main_input.prop("disabled", this.options.data.length === 0);
        if (this.options.data.length === 0) {
            placeholder = "Нет данных";
            this._$jstree_input_wrapper.removeClass('hierarchy_filter_checked');
        } else if (this._old_result.length > 0) {
            placeholder = this.is_single_choice() ? this.get_selected_name() : this.options.label;
            this._$jstree_input_wrapper.addClass('hierarchy_filter_checked');
        } else {
            placeholder = this.options.placeholder;
            this._$jstree_input_wrapper.removeClass('hierarchy_filter_checked');
        }

        this._$main_input.attr('placeholder', placeholder);
    },
    /**
     * Возвращает массив нод у которвых нет родителя.
     * @returns {Array}
     */
    _get_parent_nodes: function() {
        var self = this;
        return $.grep(self.options.data, function (e) { return '#' === e.parent; });
    },
    /**
     * Возвращает значение атрибута id первой корневой ноды.
     * @returns {Number}
     */
    _get_parent_node_id: function() {
        return this._get_parent_nodes()[0].id;
    },

    _button_cancel: function () {
        this.close_tree();
        this.cancel();
    },
    _button_clear: function () {
        if (this.options.disabled) {
            return;
        }

        this.clear({
            withoutSaving: true,
            clear: 'value'
        });
    },
    _button_approve: function () {
        if (this.options.disabled) {
            return;
        }
        this.close_tree();
        if (this._$main_input) this._$main_input.change();
        this.accept();
    },
    _button_minimize: function () {
        this._minimize_nodes();
    },
    _minimize_nodes: function() {
        var self = this;
        if (self.options.data.length) {
            self._get_parent_nodes().forEach(function (node) {
                self._$jstree.jstree("close_all", node.id);
            });
        }
    },
    _checkbox_switch_deleted: function(state) {
        /** true => чекбокс выбран
         *  false => выделение снято
         *  если undefined => работает как toggle **/
        var hiddenDeletedClass = 'jstree_hidden_deleted';
        this._$tree_wrapper.toggleClass(hiddenDeletedClass, state);
        sessionStorage.setItem(window.location.pathname + '?is_' + hiddenDeletedClass,
                               this._$tree_wrapper.hasClass(hiddenDeletedClass));
    },

    clear_filters: function() {
        this._checkbox_switch_deleted(false);
    },

    _bind_events: function () {
        var self = this;
        
        if (!self.options.simplified) {
            self._bind_document_events();
        } else {
            self._bind_change_events();
        }

        self._bind_refresh_events();
        self._extend_jstree();

        /*Инициалиализация в зависимости от типа*/
        if (self.is_single_choice()) {
            self._bind_single_jstree_events();
        } else {
            self._bind_multiple_jstree_events();
        }
    },
    _extend_jstree: function() {
        var self = this,
            jstreeWidget = this._$jstree.jstree(true);

        /** disable node expanding by double-clicking on a check-box **/
        self._$jstree.off('dblclick.jstree', '.jstree-anchor');
        self._$jstree.on('dblclick.jstree', '.jstree-anchor', $.proxy(function (e) {
            if(e.target.tagName && e.target.tagName.toLowerCase() === "input") { return true; }
            if(jstreeWidget.settings.core.dblclick_toggle && !$(e.target).hasClass('jstree-checkbox')) {
                    jstreeWidget.toggle_node(e.target);
            }
        }, jstreeWidget));

        /** add actual extension **/
        var extension = {
            get_state: function () {
                var left = 0,
                    top = 0,
                    state = {
                        'core': {
                            'open': [],
                            'scroll': {
                                'left': left,
                                'top': top
                            },
                            'selected': []
                        }
                    },
                    i;

                /** undefined doesn't work here **/
                if (this.element !== null) {
                    state.core.scroll.left = this.element.scrollLeft();
                    state.core.scroll.top = this.element.scrollTop();
                }

                for (i in this._model.data) {
                    if (this._model.data.hasOwnProperty(i)) {
                        if (i !== $.jstree.root) {
                            if (this._model.data[i].state.opened) {
                                state.core.open.push(i);
                            }
                            if (this._model.data[i].state.selected) {
                                state.core.selected.push(i);
                            }
                        }
                    }
                }
                return state;
            }
        };

        /** apply extension**/
        $.extend(true, $.jstree.core.prototype, extension);
    },
    _is_disabled_node: function(chosen_node_id, tree_type) {
        var self = this,
            $chosen_li = self._$jstree.find('li#' + chosen_node_id);

        if (!self._$jstree.jstree("is_leaf", chosen_node_id) && self.options.type === tree_type ||
            _is_not_clickable($chosen_li) ||
            self.options.disabled)
        {
            return true;
        } else {
            return false;
        }
    },
    _bind_multiple_jstree_events: function () {
        this._$jstree.on("changed.jstree", {self: this}, function (e, data) {
            var self = e.data.self,
                action = data.action;

            if (action === 'select_node') {
                if (self._is_disabled_node(data.node.id, HIERARCHY_FILTER_TYPE.MULTI_CHOICE_ONLY_LEAF)) {
                    e.preventDefault();
                    self._$jstree.jstree(true).deselect_all(true);
                    self._$jstree.jstree(true).select_node(self._old_result, true);
                }
            }

            if (action === 'deselect_node') {
                if (self._is_disabled_node(data.node.id, HIERARCHY_FILTER_TYPE.MULTI_CHOICE_ONLY_LEAF)) {
                    e.preventDefault();
                    self._$jstree.jstree(true).select_node(data.node.id, true, true);
                }
            }

            if (self.options.simplified) {
                self._set_main_input_placeholder();
            }
        });

    },
    _bind_single_jstree_events: function () {
        this._$jstree.on("changed.jstree", {self: this}, function (e, data) {
            var self = e.data.self,
                action = data.action;

            if (data.node != undefined) {
                if (action == 'select_node') {
                    if  (self._is_disabled_node(data.node.id, HIERARCHY_FILTER_TYPE.SINGLE_CHOICE_ONLY_LEAF)) {
                        e.preventDefault();
                        self._$jstree.jstree(true).deselect_node(data.node.id, true);
                        self._$jstree.jstree(true).select_node(self._old_result, true);
                    }
                }
            }

            if (self.options.simplified) {
                self.accept();
                self._set_main_input_placeholder();
            }
        });
    },
    _bind_refresh_events: function() {
        var self = this;
        self._$jstree.on("refresh.jstree", function () {
            switch(self._refresh_hash) {
                case 'update_data':
                    var searchString = self.get_search_string();
                    self._set_selected(self.options.selected);
                    if (searchString && self._$main_input) self._$jstree.jstree("search", searchString);
                    self._open_and_scroll_tree();
                    self._$jstree.jstree('restore_state');
                    self._$jstree.trigger('afterchange.jstree');
                    break;
                case 'clear_data':
                    self.clear({clear: 'value'});
                    self._$jstree.trigger('afterchange.jstree');
                    break;
            }
            self._refresh_hash = '';
        });
    },
    _document_onmousedown: function(e) {
        var self = e.data.self,
            searchString = self.get_search_string();

        if (!self.is_active()) {
            return;
        }
        /** кликнули внутри контейнера - ничего не делаем */
        if ($(e.target).closest(self._$jstree_main_wrapper).length) {
            return;
        }

        /** доп.проверка: вдруг юзер вручную удалил выбор */
        self._set_main_input_placeholder();

        /** if clicked somewhere else */
        self._button_cancel();
        self._$main_input.val(searchString);
    },
    _bind_document_events: function () {
        var self = this;

        self._document_event = function (e) {
            self._document_onmousedown(e);
        };

        $(document).on('mousedown', {self: self}, self._document_event);
    },

    _bind_change_events: function () {
        var self = this;
        self._$jstree.on("activate_node.jstree", function () {
            self.accept();
            self._set_main_input_placeholder();
        });
    },

    _create: function () {
        var self = this,
            _options = this.options;

        /**проверки на: лист, корень, узел*/
        if (this.is_single_choice()) {
            this.is_leaf = function() {
                return self._$jstree.jstree(true).is_leaf(_options.selected) && self.get_selected().length > 0;
            };

            this.is_node = function() {
                return !self.is_leaf() && !self.is_root();
            };

            this.is_root = function() {
                return self._$jstree.jstree(true).get_path(_options.selected).length === 1;
            };

            this.get_selected_name = function() {
                var selectedIdArray = self.get_selected();
                if (selectedIdArray.length === 0) return "";

                var name = self._$jstree.jstree(true).get_text(self._$jstree.jstree(true).get_node(selectedIdArray[0]));
                //экранирование
                return $("<div>").html(name).text();
            };
        }

        this._$jstree_hidden_input = this.element;

        if (!_options.simplified || !_options.disable_search) {
            this._$main_input = this._make_main_input(_options.placeholder);

            this._$jstree_input_wrapper = this._$jstree_hidden_input.wrap('<div class="hathi-field jstree-field"></div>').parent();
            this._$jstree_input_wrapper.toggleClass('simplified', _options.simplified);
            this._$jstree_hidden_input.before(this._$main_input);
        }

        this._$tree_wrapper = $('<div class="hierarchy_filter_common_container common_container"></div>').toggleClass('simplified', _options.simplified);
        this._$jstree = $('<div class="jstree"></div>').addClass('treetype_' + _options.type);
        this._$jstree_main_wrapper = this._$jstree_hidden_input.closest('.jstree_wrapper');

        var $buttons = $('<div class="jstree_buttons"></div>');

        this._$tree_wrapper.append($buttons, this._$jstree);

        if (!_options.simplified) {
            this._make_buttons($buttons);
            $buttons.on('click', '.hathi-button', {self: this}, function (e) {
                var self = e.data.self;

                if (self._$main_input) self._$main_input.val('');
                self._$jstree.jstree(true).clear_search();
                self._set_main_input_placeholder();
            });
        }

        if (_options.show_checkbox_hide_deleted) {
            this._make_toggle_deleted_checkbox($buttons);

            this._$tree_wrapper.toggleClass('jstree_hidden_deleted',
                                            sessionStorage.getItem(window.location.pathname + '?is_jstree_hidden_deleted') === 'true');
        }

        /*инициализация*/
        var config = $.extend(true, {}, defaultJSTreeConfig);
        config.checkbox.three_state = !HIERARCHY_FILTER_TYPE.is_single_choice(_options.type);
        config.core.multiple = HIERARCHY_FILTER_TYPE.is_multi_choise(_options.type);
        if (_options.disable_sort) {
            _disable_tree_plugins(config, ['sort']);
        }
        if (_options.simplified && _options.disable_search) {
            _disable_tree_plugins(config, ['search']);
        }

        this._$jstree.jstree(config);

        if (_options.disabled) {
            this.disable();
        }

        /*очистим state, сохраненный автоматически в кеше*/
        this._$jstree.jstree('clear_state');

        /*Загрузка*/
        this._read_selected_from_source_input();
		
        /** TODO: баг, связанный с неправильными данными
         * https://toolset.at-consulting.ru/jira/browse/SUBP-3094?focusedCommentId=147419&page=com.atlassian.jira.plugin.system.issuetabpanels:comment-tabpanel#comment-147419*/
        this._$jstree_hidden_input.val(function (_, val) { return val.replace(/^\[|\]$/g,''); });

        if (_options.url.length > 0) {
            this._load_json_and_update_tree(_options.url);
        } else {
            this._update_jstree_data(_options.data);
        }
		
        this._bind_events();

        this._$jstree_main_wrapper
                .append(this._$tree_wrapper)
                .on('keydown', {self: this}, function (e) {
                    var self = e.data.self;

                    if (!self.is_active()) {
                        return;
                    }

                    if (e.keyCode === $.ui.keyCode.ESCAPE) {
                        self._button_cancel();
                        e.preventDefault();
                    }
                });
    },

    destroy: function () {
        $(document).off('mousedown', this._document_event);
        this.clear();
        this._$jstree.jstree("destroy");
        this._$tree_wrapper.remove();
        if (this._$main_input) this._$main_input.remove();
        this._$jstree_hidden_input.unwrap();
    }
};

$.widget('hathi.hierarchyFilter', hierarchyFilter);

}());